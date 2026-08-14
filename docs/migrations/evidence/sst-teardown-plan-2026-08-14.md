# SST teardown plan (2026-08-14)

State of the Pulumi/SST stack after Alchemy took over production, and what has
to be removed from state before `sst remove` can run safely.

Context: `prod-cutover-2026-08-13.md` covers the cutover itself. This document
covers only the teardown of what SST still owns.

## Why this is needed

`sst remove` destroys every resource in Pulumi state. Some of those resources
are still live and serving traffic, and some hold data that has no other copy
under SST's control. Pulumi has no knowledge of the Alchemy takeover, so it
will happily delete things Alchemy now depends on, and things nothing manages
at all.

`sst state remove` drops a resource from state without touching the real
resource. That is the mechanism used below.

## What SST state still contains

Exported with `sst state export --stage prod`. 8 DNS records, 3 Worker custom
domains, 2 R2 buckets, 1 ruleset, 2 Worker scripts, plus the AWS estate
(ECS, VPC, ACM, SES, CloudFront, API Gateway).

### Must be removed from state (destructive if left)

| Resource | Live object | Why |
| --- | --- | --- |
| `EmailTXTRecordDmarcgoosebumpsfm` | `_dmarc` TXT | DMARC policy for the apex; Cloudflare's own DKIM relies on it |
| `DatabaseBackupsBucket` | `gbfm-prod-databasebackupsbucket-*` | Two pre-D1 Postgres dumps, no other copy |

Email sends through **Cloudflare**, not SES. `email-deployment-config.ts` only
supports `'cloudflare' | 'recording'`, and the live zone carries
`cf2024-1._domainkey`, `cf-bounce.mail` and an SPF record pointing at
`_spf.mx.cloudflare.net`.

The three `*.dkim.amazonses.com` CNAMEs in state are SES leftovers signing for
a provider no longer in use. They are safe to delete. The `_dmarc` TXT at the
apex is not.

### Verified replicated, safe to destroy

Every user-facing asset exists in the Alchemy R2 buckets. Confirmed by diffing
key+size listings.

| SST bucket | Objects | Alchemy equivalent | Result |
| --- | --- | --- | --- |
| `gbfm-prod-usercontentbucket-*` | 198 (983 MB) | `gbfm-usercontent-prod-*` | Identical |
| `gbfm-prod-mixesbucket-*` | 25 (3.79 GB) | `gbfm-mixes-prod-*` | Identical |
| `gbfm-user-content` (R2) | 3 | superseded | Subset |
| `gbfm-mixes` (R2) | 25 | `gbfm-mixes-prod-*` | Identical |

The database backups bucket is the exception: two `.sql` dumps from
2026-08-07, taken before the D1 cutover, with no equivalent anywhere else.
Losing them removes the only rollback path to Postgres state.

When comparing, note that `aws s3 ls` output can be truncated before it reaches
a pipe. Take counts from `--summarize` totals, and cross-check the line count,
rather than trusting a piped listing.

### Safe to leave in state

Cloudflare reassigned these hostnames to the Alchemy Workers during the
2026-08-13 deploy. Pulumi's entries are stale pointers to attachments that no
longer exist as it remembers them.

| Resource | Current state |
| --- | --- |
| `gbfm-wwwRouterDomain` | `www.goosebumps.fm` now serves from the Alchemy worker |
| `gbfm-wwwRouterAlias0Domain` | Apex now serves from the Alchemy worker |
| `CdnRouterWorkerDomain` | `cdn.goosebumps.fm` now serves from the Alchemy CDN router |
| `vps-redirects` | Superseded by Alchemy's `VpsRedirects` ruleset |
| `RouterCdnCNAMERecordCdngoosebumpsfm` | `cdn` CNAME to CloudFront, superseded |
| Both `…SslCNAMERecord…` records | ACM validation records for retired certs |

### Needs a decision

`r2-cdn.goosebumps.fm` is a **separate hostname** from `cdn.goosebumps.fm`. It
is still live and still bound to SST's `gbfm-prod-cdnrouterworkerscript`.
Nothing else serves it.

- If anything still links to `r2-cdn.goosebumps.fm`, remove it from state.
- If nothing does, let `sst remove` take it.

`vps.goosebumps.fm` is in the same category: its DNS record and the API Gateway
behind it go when the AWS estate goes. That is the intended outcome, but it is
a deliberate choice rather than a side effect.

## Scripts to run

`sst` is not on `PATH`; use the workspace binary.

Each command prints the resource plus every dependency reference it will drop,
then prompts `Do you want to commit these changes? (Y/n)`. Read the list before
confirming.

Download the database backups first. They are the only copy.

Resolve the bucket name from state rather than hardcoding it:

```bash
cd /Users/guidefari/source/oss/gbfm
mkdir -p ~/gbfm-backups

BACKUPS=$(./node_modules/.bin/sst state export --stage prod \
  | jq -r '.latest.resources[]
      | select(.urn | endswith("::DatabaseBackupsBucket"))
      | .outputs.bucket')

aws s3 sync "s3://$BACKUPS" ~/gbfm-backups/
```

Then drop from state what must survive the teardown:

```bash
./node_modules/.bin/sst state remove EmailTXTRecordDmarcgoosebumpsfm --stage prod
./node_modules/.bin/sst state remove DatabaseBackupsBucket --stage prod
```

Optional, only if `r2-cdn.goosebumps.fm` should survive:

```bash
./node_modules/.bin/sst state remove CdnRouterWorkerScript --stage prod
```

Everything else can go. The R2 buckets `gbfm-mixes` and `gbfm-user-content`
may also be dropped from state if the redundant copies are worth keeping, but
their contents exist in the Alchemy buckets either way.

Verify before tearing anything down:

```bash
./node_modules/.bin/sst state export --stage prod \
  | jq -r '.latest.resources[] | select(.type | test("dnsRecord|r2Bucket")) | .urn'
```

Expect the 4 email records and both R2 buckets to be absent. Then:

```bash
./node_modules/.bin/sst remove --stage prod
```

## The AWS estate being torn down

None of this serves production traffic except where noted. This is the bulk of
the remaining AWS bill.

| Group | Resources |
| --- | --- |
| Network | VPC, 4 subnets, 4 route tables + associations, internet gateway, 2 security groups, Cloudmap namespace |
| Bastion | EC2 instance, keypair, IAM role + instance profile, SSM parameter holding the private key |
| ECS | Cluster, capacity providers, `gbfm_vps` service, 2 task definitions, autoscaling target + 2 policies, Cloudmap service |
| API Gateway | HTTP API, stage, route, integration, VPC link, domain name, API mapping |
| CloudFront | Distribution, cache policy, request function, KV store |
| Certificates | 2 ACM certs + validations (`cdn`, `vps`) |
| Bluesky cron | EventBridge schedule, task definition, 3 IAM roles, log group |
| Email | SES v2 identity, configuration set, domain verification |
| Logs | 3 CloudWatch log groups |
| S3 | 3 buckets with CORS, policy, public access block, plus `QrPdfLifecycle` |

`vps.goosebumps.fm` still returns **200**. The ECS service is live and serving
even though nothing in the codebase points at it any more: `apps/www` builds
against `api.goosebumps.fm`, and the redirect ruleset moved to the Worker. It
is the intended casualty of the teardown, but it is a working endpoint, not a
corpse. Anything external still calling it breaks at removal.

`QrPdfLifecycle` expired `qr-pdfs/` after a day. Its replacement is the
`cleanupExpiredQrPdfs` sweep on the `17 * * * *` cron, added 2026-08-14. Note
the service uses a 30 minute window rather than the lifecycle rule's one day.

## Syntax notes

`sst state remove` takes the **short resource name**, not the full Pulumi URN.
Passing a full URN exits with `No changes made` and does not error, which looks
like success. Confirm with a re-export rather than trusting the exit.

It removes dependency references alongside the resource, so ordering between
the commands does not matter.

The confirmation prompt cannot be answered from a non-interactive shell.

## Verification performed

- `sst state export --stage prod` enumerated every resource and its type
- Live Worker custom domains listed via the Cloudflare API and compared against
  state; `www`, apex and `cdn` confirmed pointing at Alchemy workers
- `r2-cdn.goosebumps.fm` confirmed still bound to the SST script
- Object listings for `gbfm-mixes` and `gbfm-mixes-prod-*` diffed on key+size,
  identical across 25 objects
- `gbfm-user-content` confirmed to hold 3 audio objects
- `sst state remove` syntax established against a dead ACM validation record;
  state left unchanged because the prompt could not be answered
- All 198 user-content objects diffed on key+size between the S3 bucket and
  `gbfm-usercontent-prod-*`: identical
- Live zone DNS inspected to confirm email sends through Cloudflare, not SES
- `vps.goosebumps.fm` probed and returning 200; no code references remain

## Teardown log

Steps completed against this plan, newest last.

- **2026-08-14 — CI deploy path removed.** Deleted
  `.github/workflows/deploy.yml`, the SST `Prod Deployment` workflow. Every one
  of its steps was already `if: false` from OPS-244, and `release.yml` already
  triggers `alchemy-deploy.yml` instead, so nothing in CI changes behaviour.
  Updated the three docs that pointed at it:
  `docs/monitoring/production-deployment-gate.md`,
  `docs/migrations/ses-to-cloudflare-email.md` and
  `docs/troubleshooting/cloudflare-ruleset-error-20217.md`.
  `apps/server/scripts/verify-production-deployment.ts` is now orphaned; it
  probes `vps.goosebumps.fm` and inspects the ECS service, so it stops being
  meaningful once the AWS estate goes. Left in place for now.

## Open items

- The `:17` maintenance sweep is not yet confirmed end to end. `wrangler tail`
  pretty-prints JSON across multiple lines, so single-line filters miss the
  cron events. A multi-line-aware filter is needed to catch it.
- The `qr-pdfs/` prefix is empty, which is consistent with the sweep working
  but does not prove it ran. An empty prefix looks the same either way.
- Live cron schedules on the prod API Worker are `* * * * *`, `0 * * * *` and
  `17 * * * *`, matching `apps/server/src/scheduled.ts` exactly. No strays.
