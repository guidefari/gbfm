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
| `EmailTXTRecordDmarcgoosebumpsfm` | `_dmarc` TXT | Deleting breaks DMARC |
| `EmailCNAMERecord…3sybgtfwdm…` | DKIM CNAME | Deleting breaks SES deliverability |
| `EmailCNAMERecordRjjbcedugk…` | DKIM CNAME | Same |
| `EmailCNAMERecordThdzddrc4…` | DKIM CNAME | Same |
| `MixesR2Bucket` | `gbfm-mixes` | Holds 25 mixes |
| `UserContentR2Bucket` | `gbfm-user-content` | Holds 3 audio objects |

Email is still on SES, so the DKIM and DMARC records are load-bearing.

The two buckets are the pre-Alchemy originals. Production serves from
`gbfm-mixes-prod-*` and `gbfm-usercontent-prod-*` instead. The mixes were
verified byte-identical between old and new by diffing key+size listings, so
these are a redundant copy rather than live data. They are worth keeping until
the copy is deliberately retired.

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

```bash
cd /Users/guidefari/source/oss/gbfm

./node_modules/.bin/sst state remove EmailTXTRecordDmarcgoosebumpsfm --stage prod
./node_modules/.bin/sst state remove EmailCNAMERecord3sybgtfwdm4iyym7m5hcjpeamz5bviegdomainkeygoosebumpsfm --stage prod
./node_modules/.bin/sst state remove EmailCNAMERecordRjjbcedugk5o2ttwdisezyzgj3iq73rsdomainkeygoosebumpsfm --stage prod
./node_modules/.bin/sst state remove EmailCNAMERecordThdzddrc4ncngui3irzbkzuw3feibd3ndomainkeygoosebumpsfm --stage prod

./node_modules/.bin/sst state remove MixesR2Bucket --stage prod
./node_modules/.bin/sst state remove UserContentR2Bucket --stage prod
```

Optional, only if `r2-cdn.goosebumps.fm` should survive:

```bash
./node_modules/.bin/sst state remove CdnRouterWorkerScript --stage prod
```

Verify before tearing anything down:

```bash
./node_modules/.bin/sst state export --stage prod \
  | jq -r '.latest.resources[] | select(.type | test("dnsRecord|r2Bucket")) | .urn'
```

Expect the 4 email records and both R2 buckets to be absent. Then:

```bash
./node_modules/.bin/sst remove --stage prod
```

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

## Open items

- The `:17` maintenance sweep is not yet confirmed end to end. `wrangler tail`
  pretty-prints JSON across multiple lines, so single-line filters miss the
  cron events. A multi-line-aware filter is needed to catch it.
- The `qr-pdfs/` prefix is empty, which is consistent with the sweep working
  but does not prove it ran. An empty prefix looks the same either way.
- Live cron schedules on the prod API Worker are `* * * * *`, `0 * * * *` and
  `17 * * * *`, matching `apps/server/src/scheduled.ts` exactly. No strays.
