# S3 bucket inventory — 2026-08-08

Evidence for [OPS-235](https://linear.app/guidefari/issue/OPS-235/inventory-user-content-and-mixes-buckets). The machine-readable result is in [`s3-inventory-2026-08-08.json`](s3-inventory-2026-08-08.json).

## Reproduce

From the repository root, with read access to both production buckets:

```sh
bun run scripts/inventory-buckets.ts \
  > docs/migrations/evidence/s3-inventory-$(date +%F).json
```

The script only sends `ListObjectsV2`, `HeadObject`, and `ListMultipartUploads` requests. It does not read object bodies or send mutating requests. Object keys are redacted as SHA-256 hashes plus file extensions.

Captured at `2026-08-08T19:35:06.743Z` using ambient AWS credentials.

## Limits checked

- The migration's expected-profile threshold is 500,000,000 bytes per object.
- [Super Slurper](https://developers.cloudflare.com/r2/data-migration/super-slurper/) skips objects larger than 1 TB and AWS archival storage classes other than Glacier Instant Retrieval.
- [R2 limits](https://developers.cloudflare.com/r2/platform/limits/) allow 1,024-byte keys and 8,192 bytes of object metadata.

## Results

| Bucket | Objects | Total bytes | Largest object | Storage class | Incomplete multipart uploads |
| --- | ---: | ---: | ---: | --- | ---: |
| `User_Content` | 198 | 983,213,381 | 153,937,574 bytes (`.mp3`) | 198 `STANDARD` | 0 |
| `Mixes` | 25 | 3,794,106,703 | 265,858,611 bytes (`.mp3`) | 25 `STANDARD` | 0 |

The largest-object key hashes are recorded in the JSON evidence. No object exceeds the 500 MB expected-profile threshold or Super Slurper's 1 TB limit.

### Metadata shape

| Bucket | Content types | Custom metadata | Encryption | Maximum estimated metadata bytes |
| --- | --- | --- | --- | ---: |
| `User_Content` | 158 `image/jpeg`; 28 `image/png`; 8 `audio/mpeg`; 3 `audio/x-m4a`; 1 `image/webp` | one object with `expected-size` | 198 `AES256` | 55 |
| `Mixes` | 23 `audio/mp3`; 1 `audio/mpeg`; 1 `application/octet-stream` | none | 25 `AES256` | 36 |

Every object has `Content-Type`. The metadata estimate counts UTF-8 bytes in custom and represented HTTP metadata names and values; it is far below R2's 8,192-byte limit.

The single `Mixes` object stored as `application/octet-stream` is not a migration blocker. Preserve its source metadata during copy and include `Content-Type` in post-copy parity checks rather than normalizing it during migration.

## Exceptions and handling decisions

| Check | `User_Content` | `Mixes` | Decision |
| --- | ---: | ---: | --- |
| Above 500 MB expected profile | 0 | 0 | No multipart-copy exception path needed. |
| Above Super Slurper 1 TB limit | 0 | 0 | Use Super Slurper for all listed objects. |
| Archival storage or access tier | 0 | 0 | No restore-before-copy work needed. |
| Key above R2's 1,024-byte limit | 0 | 0 | Preserve keys byte-for-byte. |
| Metadata above R2's 8,192-byte limit | 0 | 0 | Preserve metadata and verify after copy. |
| Incomplete multipart upload | 0 | 0 | No in-flight upload needs migration handling in this snapshot. |

**Decision:** both buckets fit the expected Super Slurper profile. Proceed without a special object-copy path. Rerun this inventory immediately before each copy job because the buckets remain writable until cutover.
