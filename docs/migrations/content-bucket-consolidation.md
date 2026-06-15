# Content bucket consolidation

## What changed

We collapsed the stage split for S3-backed content storage so `dev` now links to the same physical buckets as `prod`.

The current canonical buckets are:

- `User_Content`
- `Mixes`
- `DatabaseBackups`

`MDX_Bucket` was removed because it was no longer used by the app.

## Why

The old setup kept separate buckets for `dev` and `prod`, with temporary IAM allowing each stage to reach the other stage's data. That made the storage model harder to reason about and created sync work for content that should really live in one place.

Using the `prod` buckets as the canonical storage layer means:

- one source of truth for uploaded content
- no cross-stage copy policy to maintain
- less chance of drift between environments
- simpler future migration to Cloudflare R2

## Implementation

- `infra/bucket.ts` now uses `sst.aws.Bucket.get(...)` in `dev` to reference the live `prod` buckets.
- `infra/vps.ts` no longer injects the cross-stage IAM policy.
- `sst-env.d.ts` no longer exposes `MDX_Bucket`.

## Operational note

If a bucket ever needs to move again, treat `prod` as authoritative first, then repoint `dev`. Do not reintroduce independent stage buckets unless there is a strong isolation requirement.

## Future work

The next cleanup step is to replace the AWS-backed bucket implementation with Cloudflare R2 while keeping the same app-facing bucket contract.
