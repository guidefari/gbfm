# R2 CDN router smoke test — 2026-08-08

## Scope

OPS-238 deployed the R2 CDN router to the isolated development hostname `https://r2-cdn.dev.goosebumps.fm`. The production and development `cdn.goosebumps.fm` routes were not changed.

SST created these development resources:

- R2 bucket `gbfm-dev-user-content`;
- R2 bucket `gbfm-dev-mixes`;
- Worker service `gbfm-dev-cdnrouterworkerscript`;
- custom domain `r2-cdn.dev.goosebumps.fm`.

The pinned SST version supports R2 buckets and Workers through `sst.cloudflare.Bucket` and `sst.cloudflare.Worker`. A narrow Pulumi transform assigns the required `USER_CONTENT` and `MIXES` R2 binding names. No second infrastructure tool or Wrangler deployment configuration owns these resources.

## Binding verification

The Cloudflare Workers bindings API reported exactly two R2 bindings:

| Binding | Bucket |
| --- | --- |
| `USER_CONTENT` | `gbfm-dev-user-content` |
| `MIXES` | `gbfm-dev-mixes` |

The only other Worker binding is SST's plain-text application metadata. There is no database-backup binding.

## Runtime verification

A temporary 36-byte object was written to `gbfm-dev-user-content`, requested through the test hostname, and deleted afterward.

| Check | Result |
| --- | --- |
| GET | `200`; byte-identical body |
| Range `bytes=0-9` | `206`; `Content-Range: bytes 0-9/36`; 10-byte body |
| HEAD | `200`; `Content-Type: text/plain`; `Content-Length: 36`; empty body |
| Matching `If-None-Match` | `304`; empty body |
| Missing key | `404` |

Local workerd tests also cover routing isolation, `If-Modified-Since`, stored cache and custom metadata, and the exact public R2 binding set.
