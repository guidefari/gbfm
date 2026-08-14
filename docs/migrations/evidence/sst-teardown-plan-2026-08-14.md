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

### Decided: r2-cdn.goosebumps.fm goes

`r2-cdn.goosebumps.fm` is a **separate hostname** from `cdn.goosebumps.fm`. It
is still live and still bound to SST's `gbfm-prod-cdnrouterworkerscript`, but
it was a migration-era test hostname for OPS-238 (see
[`r2-router-smoke-2026-08-08.md`](r2-router-smoke-2026-08-08.md)) and nothing
in app code references it. Confirmed 2026-08-14: grepped `apps/*` and every
package for `r2-cdn` and found no live dependency, only SST's own infra
declaration in `infra/bucket.ts` and historical migration docs.

Decision: let `sst remove` destroy it. `CdnRouterWorkerScript` is **not**
removed from state.

`vps.goosebumps.fm` is in the same category: its DNS record and the API Gateway
behind it go when the AWS estate goes. That is the intended outcome, but it is
a deliberate choice rather than a side effect.

## Scripts to run

> **Completed 2026-08-14.** Every stage has been torn down; this section is the
> record of what was run. See the teardown log for what actually happened,
> including an outage this plan did not anticipate.

`sst` is not on `PATH`; use the workspace binary.

Each command prints the resource plus every dependency reference it will drop,
then prompts `Do you want to commit these changes? (Y/n)`. Read the list before
confirming.

Download the database backups first for an offline copy, even though the
bucket itself is being allowed to go (decided 2026-08-14, see teardown log).

Resolve the bucket name from state rather than hardcoding it. Shown in fish
syntax since that is the shell in use; swap `set NAME (...)` for
`NAME=$(...)` under bash:

```fish
cd /Users/guidefari/source/oss/gbfm
mkdir -p ~/gbfm-backups

set BACKUPS (./node_modules/.bin/sst state export --stage prod \
  | jq -r '.latest.resources[]
      | select(.urn | endswith("::DatabaseBackupsBucket"))
      | .outputs.bucket')

aws s3 sync "s3://$BACKUPS" ~/gbfm-backups/
```

Then drop from state the one thing that must survive the teardown, the DMARC
record:

```fish
./node_modules/.bin/sst state remove EmailTXTRecordDmarcgoosebumpsfm --stage prod
```

`DatabaseBackupsBucket` and `CdnRouterWorkerScript` are deliberately **not**
removed from state. Both are decided to be destroyed by `sst remove` (see
[Decided: r2-cdn.goosebumps.fm goes](#decided-r2-cdngoosebumpsfm-goes) and the
teardown log). The R2 buckets `gbfm-mixes` and `gbfm-user-content` are also
left in state and will be destroyed; their contents exist in the Alchemy
buckets either way.

Verify before tearing anything down:

```bash
./node_modules/.bin/sst state export --stage prod \
  | jq -r '.latest.resources[] | select(.type | test("dnsRecord|r2Bucket")) | .urn'
```

Expect only the `_dmarc` TXT record gone from the dnsRecord list; the R2
buckets and everything else are expected to still be present here; `sst remove`
destroys them next. Then:

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

- **2026-08-14 — Decisions made on the two open items.** `r2-cdn.goosebumps.fm`
  confirmed dead (no app-code references) and approved to let `sst remove`
  destroy it; `CdnRouterWorkerScript` will not be removed from state.
  `DatabaseBackupsBucket` is also approved for destruction rather than
  preservation; the local `aws s3 sync` backup step still runs first for an
  offline copy, but the bucket itself is not being kept out of state. Only
  `EmailTXTRecordDmarcgoosebumpsfm` remains a required state-remove before
  `sst remove --stage prod` runs.

- **2026-08-14 — Prod torn down, with an outage.** `sst remove --stage prod`
  ran in stages, failing on each stale Cloudflare record in turn: Pulumi treats
  a failed delete as fatal rather than skipping, so every 404 needed a
  `sst state remove` before the run could continue.

  **Incident:** the removal deleted the Cloudflare DNS records backing
  `www.goosebumps.fm` and the apex, taking the site down. The plan listed
  `gbfm-wwwRouterDomain` and `gbfm-wwwRouterAlias0Domain` as "safe to leave in
  state", meaning the entries were stale pointers, but Alchemy still depended on
  the underlying records that Pulumi believed it owned. Recovered by
  redeploying Alchemy, which reconciles its declared custom domains:
  `bunx alchemy deploy --stage prod --profile env-token --yes`. Note Alchemy
  reads `CLOUDFLARE_ACCOUNT_ID`, while the shell exports
  `CLOUDFLARE_DEFAULT_ACCOUNT_ID`.

  **Lesson:** "stale in state" is not the same as "safe to delete". Verify each
  hostname against the live zone before letting Pulumi remove it.

- **2026-08-14 — Remaining stages.** SST registers a passphrase per stage in
  SSM, which is the authoritative stage list:

  ```bash
  aws ssm get-parameters-by-path --path /sst/passphrase/gbfm --recursive \
    --query 'Parameters[].Name' --output text
  ```

  Seven existed: `prod`, `dev`, `guidefari`, `production`, `local`, `staging`,
  `_fallback`. `local`, `staging` and `_fallback` held no resources. `dev` (160)
  and `guidefari` (116) were removed. `production` (35) was an older 2024 stage
  still holding a CloudFront distribution, ACM cert, Lambda and S3 assets.

  `dev` stalled on its VPC: a `BlueskySyncTask` wedged in `PENDING` held an ENI,
  which blocked the subnet and internet gateway. Stopping the task released it.

- **2026-08-14 — Orphaned resources cleaned up.** `removal: 'retain'` covers
  "S3 buckets and DynamoDB tables" only, so it never applied to R2; the
  non-empty R2 buckets 409'd instead. Resources it spared became unmanaged and
  invisible to `sst`, so they were deleted directly rather than by editing the
  config and re-running `sst` against prod:

  - prod VPC `vpc-02f9c09b34d644632` plus its 4 subnets
  - EventBridge schedule `gbfm-dev-BlueskySyncCronSchedule-bnahrobz`
    (`rate(1 hour)`, still ENABLED against a deleted cluster) and its IAM role
  - 3 orphaned CloudWatch log groups

  S3 buckets are deliberately retained. Two staging Workers from September 2024,
  `gbfm-staging-authworkercfscript` and `gbfm-staging-openapiworkerscript`, are
  still bound to `auth.staging` and `openapi.staging` hostnames and were left
  alone.

## Open items

- The `:17` maintenance sweep is not yet confirmed end to end. `wrangler tail`
  pretty-prints JSON across multiple lines, so single-line filters miss the
  cron events. A multi-line-aware filter is needed to catch it.
- The `qr-pdfs/` prefix is empty, which is consistent with the sweep working
  but does not prove it ran. An empty prefix looks the same either way.
- Live cron schedules on the prod API Worker are `* * * * *`, `0 * * * *` and
  `17 * * * *`, matching `apps/server/src/scheduled.ts` exactly. No strays.
