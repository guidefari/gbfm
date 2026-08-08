# R2 `Mixes` copy evidence — 2026-08-09

## Scope

Copied the production S3 `Mixes` bucket into the production R2 `gbfm-mixes` bucket with Cloudflare Super Slurper. The public `cdn.goosebumps.fm` route remained on S3 during this work.

Temporary credentials were used for the copy:

- an AWS IAM user limited to listing and reading the source bucket
- a short-lived Cloudflare token limited to R2 administration

Both credentials were deleted after Super Slurper completed.

## Copy result

Super Slurper reported:

- objects discovered: 25
- objects transferred: 25
- failed objects: 0
- skipped objects: 0

## Metadata repair

The first parity check found that Super Slurper omitted `Content-Type` from 20 destination objects. Object counts, sizes, and the sampled content hash already matched.

The missing values were restored from the source metadata with same-bucket R2 copies using metadata replacement. No object keys were logged or recorded.

## Final parity result

`scripts/verify-r2-parity.ts` reported:

- source objects: 25
- destination objects: 25
- source bytes: 3,794,106,703
- destination bytes: 3,794,106,703
- count, size, and metadata mismatches: 0
- sampled SHA-256 content hashes compared: 1
- sampled SHA-256 content hash mismatches: 0

The content sample was limited to one approximately 49 MB object to avoid downloading several gigabytes from both providers. The verifier represented the object internally by key but did not include that key in its output.

## Remaining cutover work

- configure and verify R2 CORS
- verify the copied objects through `r2-cdn.goosebumps.fm`
- switch only `/mixes/*` public reads to R2
- soak while retaining S3 for rollback
