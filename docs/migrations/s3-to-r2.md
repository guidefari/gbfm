# S3 to R2 Migration (Phase 1, promoted to step one)

Tracked in Linear under [OPS-234](https://linear.app/guidefari/issue/OPS-234/s3-to-r2-migration-parent). Each execution step below has its own issue; see [Execution Order](#execution-order).

## Summary

Move the canonical buckets from S3 to Cloudflare R2 without changing object keys or public `cdn.goosebumps.fm` URLs. Infrastructure stays in **SST**, using its Pulumi extensibility for the Cloudflare resources.

The work is not "swap an endpoint." Tracing the code surfaced four things the parent migration doc does not account for, and they drive the design:

1. **`S3Service` constructs `new S3Client({})` 13 times**, once per operation, with zero configuration. There is no seam to point at R2. This is the actual blocker, and consolidating those 13 sites into one configured client is the first deliverable.
2. **The doc's CORS claim is wrong.** It states "the current browser sends each multipart chunk through the API, so R2 browser CORS is not required for the first storage cut." It does not. `apps/www/src/services/resumable-upload/service.ts:259` calls `putPartToS3(url, part.blob, signal)` — the browser PUTs part bytes **directly to the bucket** via presigned URL, and `infra/bucket.ts:10-16` already configures bucket CORS for exactly that. **R2 CORS is required on day one for `User_Content`, and presigned writes must target the R2 S3 API hostname, not `cdn.goosebumps.fm`.**
3. **The multipart complete handler ETag-matches client parts against `listMultipartParts`** (`apps/vps/src/http/upload.handlers.ts:313-320`). R2 computes multipart ETags differently from S3. This is a live correctness risk in the request path, not just an inventory-reconciliation concern.
4. **Four backup/restore scripts construct their own `S3Client`** and use `GetObjectCommand`, which is **not on the `S3Service` interface at all**.

This migration also **deletes two things** rather than porting them: the dead cross-bucket copy path, and the entire database-backup subsystem. Both are covered below, and the second carries a precondition. The file picker that browses existing uploads stays.

Bulk copy uses **Super Slurper**. Cutover is **forward-only, R2-authoritative, per-bucket**; dual-write is rejected with reasoning.

## Context / Current State

### Buckets (`infra/bucket.ts`)

| Bucket | SST name | Public? | Lifecycle | Fate |
|---|---|---|---|---|
| `User_Content` | `gbfm-prod-usercontentbucket-cohrefob` | via `/user-content/` | `qr-pdfs/` 1d; abort incomplete MPU 1d | → R2 |
| `Mixes` | `gbfm-prod-mixesbucket-zftkfrfx` | via `/mixes/` | none | → R2 |
| `DatabaseBackups` | `gbfm-prod-databasebackupsbucket-xbxkwmwo` | no | 30d expiry | **deleted, not migrated** |

Public routing today is `sst.aws.Router` with regex rewrites stripping `/user-content` and `/mixes`, DNS via `sst.cloudflare.dns()`.

### The 13 client construction sites

`apps/vps/src/services/s3.service.ts` — every operation opens with `const s3 = new S3Client({})`:

`uploadFile`(128), `presignPutObject`(177), `deleteFile`(205), `checkExists`(238), `listObjects`(262), `copyFile`(322), `createMultipartUpload`(362), `getObjectMetadata`(396), `presignUploadPart`(444), `completeMultipartUpload`(478), `abortMultipartUpload`(513), `listMultipartParts`(541), `listBuckets`(592).

Empty config means the SDK resolves region and credentials ambiently. Nothing is injectable, and nothing is testable without live AWS. **Yes, these consolidate into one construction site** — that is the `ObjectStoreClient` seam below.

### Scripts outside the seam

- `scripts/backup-db.ts:169` — `PutObjectCommand`
- `scripts/restore-db.ts:87` — `ListObjectsV2Command`, `GetObjectCommand`
- `scripts/verify-backup.ts:51` — `ListObjectsV2Command`, `GetObjectCommand`
- `scripts/run-backup-task.ts:111` — `PutObjectCommand`

All four are backup-related, so the backup deletion removes them wholesale rather than migrating them.

### URL construction

`config.urls.bucketRouter` is hardcoded to `'https://cdn.goosebumps.fm'` (`config.service.ts:124`) and used in 6 handler sites to build `${bucketRouter}/user-content/${key}`.

**Persisted absolute URLs.** `audioTable.url` is `varchar(255)` storing full URLs (`apps/vps/src/db/audio.schema.ts:24`). `upload-asset.service.ts:135` reverses key from URL by prefix-stripping. Since the host does not change, these rows stay valid — but only because we hold the URL invariant. Precedent for a URL-rewrite migration exists: `scripts/rename-audio-cdn-name.ts`.

### Legacy CloudFront distribution

`d20tmfka7s58bt.cloudfront.net` is hardcoded in 7 files (`apps/www/src/lib/constants.ts`, `lib/seo.ts`, `routes/mixes/$mixId.tsx`, `packages/ui/src/components/artwork.stories.tsx`, `artwork-uploader.tsx`, `music-card-patterns.stories.tsx`, `apps/vps/src/routes/redirect/redirect.template.ts`) as the default OG image.

**Intent: fold this into R2 and serve everything from one source.** Scoped as a follow-up phase below rather than day-one work, because it is an independent change with its own verification (historical RSS consumers and any persisted rows referencing that host) and bundling it would widen the blast radius of the bucket cutover.

### Existing conventions to honor

- Effect services via `Context.Service` + `Layer`.
- Errors: `Data.TaggedError` (`S3Error` with `message`/`operation`/`key`). Note: **not** `Schema.TaggedErrorClass`; follow the local choice.
- Config: Effect `Schema.Struct`, both an Effect service and a sync `config` singleton.
- Spans: `Effect.withSpan('aws.s3.*')` with `aws.service`/`s3.bucket`/`s3.key_prefix`. `getKeyPrefix` deliberately logs only the first path segment.
- Tests: `@testcontainers/postgresql` present; `bun precommit` is the required gate.
- **Infrastructure is SST.** No Alchemy or standalone Wrangler. Cloudflare resources SST does not model natively are declared through its Pulumi escape hatch, the same way `infra/bucket.ts:32` already drops to `aws.s3.BucketLifecycleConfiguration`.

## Goals

1. Consolidate 13 client constructions into one configured, injectable seam.
2. `S3Service` operations run against R2, selectable by config, interface unchanged.
3. `cdn.goosebumps.fm/user-content/*` and `/mixes/*` serve from R2 with byte-identical semantics.
4. Delete the dead cross-bucket copy path.
5. Delete the database-backup subsystem end to end.
6. Contract tests covering every remaining operation, including multipart resume/abort/complete/retry.

## Non-Goals

Cloudflare Containers. D1 or any database migration. SES/email. Reminders, sitemap. Compute/deployment migration. AWS teardown. Alchemy adoption. Direct-to-R2 upload redesign beyond preserving today's presigned flow. Legacy CloudFront consolidation (deferred to a follow-up phase, scoped below).

## Invariants

- **I1.** Object keys are byte-identical across the move.
- **I2.** `https://cdn.goosebumps.fm/user-content/<key>` and `/mixes/<key>` resolve to the same bytes, before and after.
- **I3.** The `S3Service` TypeScript interface does not change **except** for the removal of `copyFile`. Upload, QR, music-entity, and file-picker callers are untouched.
- **I4.** No public route can reach a non-public bucket.
- **I5.** No credential enters an error, log, span attribute, or test snapshot.
- **I6.** Multipart part size stays 8 MiB (`CHUNK_SIZE`, `upload.handlers.ts:13`), satisfying R2's ≥5 MiB equal-non-final-part rule.
- **I7.** Infrastructure remains declared in SST; no parallel IaC tool owns any resource in this phase.

## Design Constraints

- **C1.** R2 has no `ListBuckets` equivalent matching how `listBuckets` is used today. Resolved by returning configured bucket names on the R2 provider. See "Feature removal: cross-bucket copy."
- **C2.** R2 multipart ETags differ from S3. The complete-handler ETag equality check must be verified against real R2 before cutover.
- **C3.** Presigned URLs must be signed against the R2 S3 API hostname (`<account>.r2.cloudflarestorage.com`), never the public custom domain.
- **C4.** R2 bucket CORS must allow `PUT` from the same origins as `contentBucket` today, exposing `ETag`.
- **C5.** R2's single-request `CopyObject` ceiling is expected to be comfortable — files are believed to be well under 500 MB. Inventory confirms rather than discovers this; treat a >500 MB object as an exception needing multipart copy, not as the expected case.
- **C6.** Credentials become explicit and long-lived (R2 access key pairs) where S3 used ambient IAM. Delivered as **SST secrets**, held as `Redacted`, unwrapped only at client construction.

## Feature removal: cross-bucket copy

**Decision: delete the cross-bucket transfer path only. The file picker stays.**

The picker is user-facing and load-bearing — it lets an editor choose an already-uploaded object instead of re-uploading:

- `apps/www/src/routes/mix-upload.lazy.tsx:706` — audio picker in the mix upload flow
- `apps/www/src/components/content/ImageUploadField.tsx:4` — image picker in content editing

It needs exactly two endpoints, `config` and `list`, both of which are kept.

Cross-bucket copy is a different thing that happens to live in the same handler group. It is **dead code**: `copyFileManagerObject` has no frontend caller anywhere in `apps/www` or `packages/ui`. The only path to `S3Service.copyFile` is that one unreferenced endpoint (`file-manager.handlers.ts:94`).

Surface to delete:

| Layer | Path |
|---|---|
| API contract | `CopyObjectInput`, `CopyObjectResponse`, and the `copyFileManagerObject` endpoint (`packages/api/src/file-manager.ts:30-39,55-61`) |
| Handler | `.handle('copyFileManagerObject', ...)` (`file-manager.handlers.ts:84-110`) |
| Service | `S3Service.copyFile` + `copyFileEffect` (`s3.service.ts:62-66,319-352,625`) |

Deleting an operation with no caller ahead of a storage migration is strictly better than carrying it: R2's `CopyObject` size ceiling (C5) and cross-bucket copy semantics stop being things this migration has to prove. It can return if a real need appears.

`getFileManagerConfig` and `listFileManagerObjects` are untouched, as are `S3AudioFilePicker`, `S3MediaFilePicker`, and `packages/ui/src/components/s3-media-file-picker.tsx`.

### `listBuckets` and C1

`listBuckets` cannot be deleted with copy — it populates `availableBuckets`, which feeds the picker's bucket dropdown (`s3-media-file-picker.tsx:20`) and its final fallback for `effectiveBucket` (`S3AudioFilePicker.tsx:36`). So C1 still needs an answer.

It already degrades gracefully: `file-manager.handlers.ts:30-37` catches `S3Error` and returns `[]`, falling back to the configured buckets. The dropdown keeps working because `buckets.userContent` and `buckets.mixes` come from config, not from the listing.

**Recommendation: on the R2 provider, return the configured bucket names directly rather than issuing a bucket-listing call.**

```ts
// r2 provider implementation
listBuckets: () => Effect.succeed([config.buckets.userContent, config.buckets.mixes])
```

This preserves the dropdown, avoids an operation whose R2 semantics differ, and is honest about what the picker can actually browse. The observable change is that `FILE_MANAGER_BUCKETS` extras and any unconfigured bucket stop appearing — acceptable, since browsing a bucket the app does not own was never a supported flow.

## Feature removal: database backups

**Decision: remove the entire backup subsystem**, on the stated basis that the managed database provider supplies backups.

**Precondition, and the one open item in this spec.** The database host is an SST secret (`infra/secret.ts:4`), so the provider's backup guarantees cannot be verified from the repository. Before any deletion lands, confirm and record in `docs/migrations/evidence/`:

1. the provider's automated backup cadence and retention window;
2. that **point-in-time or snapshot restore has actually been exercised**, not merely advertised;
3. who holds restore access.

The current system produces daily independent dumps in a separate account, retained 30 days. Provider-managed backups are typically a strictly better operational story, but they fail differently: they are in the same account and same blast radius as the database. Deleting a working, independent backup path on an unverified assumption is the single highest-consequence action in this migration. `docs/backup-feature-audit.md` exists and should be updated to record the decision.

Given the above, this deletion is sequenced **last**, after storage cutover is soaked. If the precondition fails, the `DatabaseBackups` bucket migrates to R2 as originally planned and the scripts move to the new seam; the rest of the spec is unaffected.

Surface to delete:

| Layer | Path |
|---|---|
| Scripts | `apps/vps/scripts/backup-db.ts`, `restore-db.ts`, `verify-backup.ts`, `run-backup-task.ts`, `backup-utils.ts`, `docker-restore.sh` |
| Infra: cron | `dbBackupCron` and `testFunction` (`BackupTaskInvoker`) in `infra/cron.ts` |
| Infra: task | `dbBackupTask` in `infra/vps.ts` |
| Infra: lambda | `apps/cron/invoke-backup-task.ts` |
| Infra: bucket | `dbBackupBucket` in `infra/bucket.ts` |
| Config | `buckets.databaseBackups`, `tasks.databaseBackup` in `config.service.ts` |
| Email | `packages/email/emails/backup-notification.tsx` + its sender export |
| Docs | update `docs/backup-feature-audit.md` to record the decision |

Do not delete the S3 backup bucket's **contents** in the same change that removes the code. Let existing objects age out under the 30-day lifecycle so a restore remains possible during the transition.

This removal also eliminates the `getObjectStream` gap — `GetObjectCommand` was used only by `restore-db.ts` and `verify-backup.ts`. With both gone, **no read-object operation needs to be added**.

## Alternatives Considered

### Option 1: Endpoint-only patch

Add `endpoint`/`region` to each of the 13 `new S3Client({})` calls.

Smallest diff. But it multiplies existing duplication by 13, leaves credentials ambient (violating C6), and provides no seam for contract tests — every test would need live credentials. **Rejected**: it does not create the seam, and consolidation is an explicit goal.

### Option 2: Provider-selectable client factory behind an Effect Layer (recommended)

One `ObjectStoreClient` service owning a single configured client, plus `storage` config in `ConfigService`. `S3Service` becomes `Layer.effect` depending on it.

One construction site. Credentials injected as `Redacted`. Provider selectable for a per-bucket cutover. Contract tests run through the same seam. All upload/QR/music-entity callers untouched.

Cost: `S3ServiceLayer` gains a dependency, so `runtime/services.ts` composition changes and `Layer.succeed` becomes `Layer.effect`.

### Option 3: Full storage-domain rewrite

Replace `S3Service` with a provider-neutral `ObjectStore` in domain vocabulary, rewriting all callers. Better long-term naming, but touches 11 consumer files during a data migration. **Rejected for now**; revisit once R2 is stable.

## Recommendation

**Option 2**, with a **forward-only, per-bucket, R2-authoritative** cutover, `Mixes` first.

Ordering changed from the original draft: `DatabaseBackups` was going to be the low-risk rehearsal, but it is now being deleted rather than migrated. `Mixes` inherits that role — read-mostly, no direct-PUT upload path, so it exercises copy, verification, CORS, and router switching without the multipart flow. `User_Content` follows, carrying all upload risk.

### Why forward-only rather than dual-write

- Dual-write cannot cover the hot path. Both the image PUT and every multipart part go **browser → bucket directly** via presigned URL. The server never sees those bytes and cannot mirror them. A dual-write that misses the primary upload path is not a rollback guarantee; it is the appearance of one.
- Multipart sessions cannot be meaningfully mirrored — `uploadId` is provider-specific, and you would reconcile ETags that legitimately differ (C2).
- Both remaining buckets are append-heavy. The realistic failure is "R2 serves wrong or missing bytes," caught by verification before cutover, not by a write-mirror after it.

Instead: keep S3 objects **in place and readable** through the rollback window, make R2 authoritative for writes, and keep the router origin switchable. Rollback is flipping the origin back plus a reverse delta copy for anything written to R2 during the window.

## Proposed Design

```
                      ConfigService.storage        (SST secrets)
                              │
                              ▼
                    ObjectStoreClient (Layer)
                    ONE configured S3Client
                    ├─ provider: 'aws' | 'r2'
                    ├─ endpoint / region
                    └─ Redacted credentials
                              │
                              ▼
                    S3Service (Layer.effect)
                    interface unchanged for live callers
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
         upload.handlers            qrcode, music-entity,
         (untouched)                user.handlers (untouched)


  reads:   browser ──▶ cdn.goosebumps.fm ──▶ Worker ──▶ R2 binding
  writes:  browser ──▶ <account>.r2.cloudflarestorage.com  (presigned, C3/C4)

  all Cloudflare resources declared in SST via Pulumi provider
```

## Domain Model and Types

```ts
// apps/vps/src/services/storage/provider.ts
export const StorageProvider = {
  aws: 'aws',
  r2: 'r2'
} as const
export type StorageProvider = (typeof StorageProvider)[keyof typeof StorageProvider]
```

Objects over enums, per project convention.

```ts
// Added to ConfigSchema in config.service.ts
storage: Schema.Struct({
  provider: Schema.Literal('aws', 'r2'),
  endpoint: Schema.optional(Schema.String),   // required when provider === 'r2'
  region: Schema.String,                       // 'auto' for R2
  accessKeyId: Schema.optional(Schema.Redacted(Schema.String)),
  secretAccessKey: Schema.optional(Schema.Redacted(Schema.String)),
  signingEndpoint: Schema.optional(Schema.String)  // C3
})
```

Conditional requirement enforced at parse time, not by a runtime crash:

```ts
Schema.filter(
  (s) =>
    s.provider === 'aws' ||
    (s.endpoint !== undefined && s.accessKeyId !== undefined && s.secretAccessKey !== undefined),
  { message: () => 'r2 provider requires endpoint and credentials' }
)
```

Values arrive from SST secrets through the existing `secretString` path in `createConfig()`.

## Types, Interfaces, and APIs

### New: `ObjectStoreClient`

```ts
// apps/vps/src/services/storage/object-store-client.ts
export interface ObjectStoreClient {
  readonly client: S3Client
  readonly provider: StorageProvider
  /** Host to sign presigned URLs against. Never the public CDN domain. */
  readonly signingClient: S3Client
}

export const ObjectStoreClient = Context.Service<ObjectStoreClient>('ObjectStoreClient')
export const ObjectStoreClientLayer: Layer.Layer<ObjectStoreClient, never, ConfigService>
```

Two clients because presigned URLs need a different host than ordinary API calls (C3). When they coincide, both reference the same instance.

The raw `S3Client` never leaves this module.

### Changed: `S3Service`

```ts
// before
export const S3ServiceLayer = Layer.succeed(S3Service, { ... })

// after
export const S3ServiceLayer = Layer.effect(
  S3Service,
  Effect.gen(function* () {
    const store = yield* ObjectStoreClient
    return { uploadFile: uploadFileEffect(store), /* ... */ }
  })
)
```

Each `*Effect` gains a leading `store` parameter and drops its `new S3Client({})`.

The only interface change is removing `copyFile`. Every operation the upload path and file picker use keeps its exact signature. `listBuckets` stays, with a provider-specific implementation (C1).

### Infrastructure: R2 in SST

R2 buckets are declared through SST's Pulumi extensibility, matching the existing escape-hatch precedent at `infra/bucket.ts:32`:

```ts
// infra/bucket.ts
const userContentR2 = new cloudflare.R2Bucket('UserContentR2', {
  accountId: cloudflareAccountId,
  name: 'gbfm-user-content'
})

const cdnWorker = new cloudflare.WorkerScript('CdnRouter', {
  accountId: cloudflareAccountId,
  name: 'gbfm-cdn-router',
  content: /* bundled worker */,
  r2BucketBindings: [
    { name: 'USER_CONTENT', bucketName: userContentR2.name },
    { name: 'MIXES', bucketName: mixesR2.name }
  ]
})
```

SST keeps ownership of the `cdn.goosebumps.fm` DNS record — no state drift, no second tool. The `fileRouter` origin switches from S3 bucket routes to the Worker within the same stack.

### Worker: CDN router

```ts
interface Env {
  readonly USER_CONTENT: R2Bucket
  readonly MIXES: R2Bucket
  // no backups binding — the bucket will not exist (I4)
}

const matchRoute = (pathname: string, env: Env): RouteMatch | null
```

`matchRoute` is pure and unit-testable without the runtime, mirroring the current rewrites: `^/user-content/(.*)$ → $1`, `^/mixes/(.*)$ → $1`.

The fetch handler preserves, per I2: GET/HEAD; `Range` → 206 with `Content-Range`; `If-None-Match`/`If-Modified-Since` → 304; stored `httpMetadata` and custom metadata; ETag; 404 for misses and unmatched prefixes.

`bucket.get(key, { onlyIf, range })` and `R2ObjectBody.writeHttpMetadata(headers)` cover this directly.

## Seams, Boundaries, Adapters, and Implementations

| Seam | Owns | May not leak |
|---|---|---|
| `ObjectStoreClient` | client construction, endpoint, credential unwrapping | `S3Client` beyond `S3Service` |
| `S3Service` | operation semantics, `S3Error` translation, spans | AWS SDK command types to handlers |
| `ConfigService.storage` | provider selection, parsed and refined config | raw credentials into logs/errors/spans |
| `workers/cdn-router` | path→bucket routing, HTTP response semantics | any binding to a non-public bucket |
| `infra/bucket.ts` | all Cloudflare + AWS resource declarations | resource ownership to any non-SST tool (I7) |

`Redacted.value` is unwrapped **only** inside `ObjectStoreClientLayer`.

## Call Stacks and Data Flow

### Current flow — multipart part upload

```
Browser: resumable-upload/service.ts uploadPart
  -> POST /upload/multipart/presign-part
  -> upload.handlers presignMultipartPart
       -> assertKeyOwnership
       -> new S3Client({})                          <-- ambient creds
       -> getSignedUrl(UploadPartCommand)           <-- S3 host
  <- { url }
  -> PUT <presigned S3 url> with blob               <-- DIRECT to bucket, needs CORS
  <- ETag header
  -> POST /upload/multipart/complete
       -> listMultipartParts -> ETag equality check <-- C2 risk
       -> completeMultipartUpload
  <- { url: `${bucketRouter}/user-content/${key}` }
```

### Proposed flow

```
Browser: uploadPart (UNCHANGED)
  -> POST /upload/multipart/presign-part
  -> upload.handlers presignMultipartPart          (UNCHANGED source)
       -> S3Service.presignUploadPart
            -> ObjectStoreClient.signingClient      <-- ONE construction site
            -> getSignedUrl(UploadPartCommand)      <-- r2.cloudflarestorage.com (C3)
  <- { url }
  -> PUT <presigned R2 url> with blob              <-- needs R2 CORS (C4)
  <- ETag header                                    <-- must be exposed
  -> POST /upload/multipart/complete
       -> listMultipartParts (R2)
       -> ETag equality check                       <-- VERIFY against real R2
       -> completeMultipartUpload
  <- { url: `${bucketRouter}/user-content/${key}` } <-- unchanged string (I2)
```

Boundary type flow:

```
SST secret / Resource
  -> secretString
  -> Schema.decode(StorageConfig)   [refinement: r2 requires endpoint+creds]
  -> StorageConfig (Redacted creds)
  -> ObjectStoreClientLayer          [Redacted.value unwrapped HERE only]
  -> S3Client
  -> S3Service operation
  -> AWS SDK command
  -> typed S3Error | domain result
```

### Public read flow

```
Browser GET https://cdn.goosebumps.fm/user-content/<key>
  -> Worker fetch(request, env)
  -> matchRoute(pathname, env)          [pure]
  -> env.USER_CONTENT.get(key, { range, onlyIf })
  -> R2ObjectBody | R2Object | null
  -> writeHttpMetadata(headers) + etag + status (200/206/304/404)
```

### Failure flow

```
R2 rejects (auth / missing / precondition)
  -> Effect.tryPromise catch
  -> new S3Error({ message, operation, key })   [no credential in message]
  -> handler dieOnS3Error | catchTag
  -> HttpApiError.InternalServerError | BadRequest
```

`checkExists` keeps `Effect.Effect<boolean, never>` and `orElseSucceed(false)`. Pre-existing wart worth stating: it swallows auth failures as "not found," so misconfigured R2 credentials read as "object absent." **Do not use `checkExists` as migration verification evidence.** Out of scope to fix; a test pins the behavior so the risk stays visible.

### Retry / cancellation / idempotency

Multipart resume already exists: `completeMultipartUpload` first calls `getObjectMetadata` and returns success if the object is already complete (`upload.handlers.ts:298-305`). The client re-presigns before each PUT retry and treats 403 as expiry.

None of this changes. The migration must prove it still holds on R2 — specifically that `listMultipartParts` ETags match what R2 returned to the browser per part (C2).

### Observability

Span names stay `aws.s3.*` (dashboards depend on them; renaming is churn mid-migration). One attribute added:

```ts
Effect.annotateCurrentSpan('storage.provider', store.provider)
```

`s3.key_prefix` truncation retained (I5).

## Files to Add / Change / Delete

### Add

| File | Responsibility |
|---|---|
| `apps/vps/src/services/storage/provider.ts` | `StorageProvider` const object |
| `apps/vps/src/services/storage/object-store-client.ts` | Single client construction, credential unwrapping |
| `apps/vps/src/services/storage/object-store-client.test.ts` | Config→client mapping, refinement rejection |
| `apps/vps/src/services/s3.service.contract.test.ts` | Live contract tests |
| `workers/cdn-router/src/index.ts` | Worker fetch handler |
| `workers/cdn-router/src/route.ts` | Pure `matchRoute` |
| `workers/cdn-router/src/route.test.ts` | Routing unit tests |
| `workers/cdn-router/test/cdn-router.test.ts` | `vitest-pool-workers` R2 semantics |
| `scripts/inventory-buckets.ts` | Read-only inventory |
| `scripts/verify-r2-parity.ts` | Post-copy reconciliation |
| `docs/migrations/evidence/` | Inventory + backup-precondition evidence |

### Change

| File | Change |
|---|---|
| `apps/vps/src/services/s3.service.ts` | Remove 13 `new S3Client({})`; thread `store`; `Layer.succeed`→`Layer.effect`; delete `copyFile`; provider-aware `listBuckets` |
| `apps/vps/src/services/config.service.ts` | Add refined `storage` struct; remove `buckets.databaseBackups`, `tasks.databaseBackup` |
| `apps/vps/src/runtime/services.ts` | Provide `ObjectStoreClientLayer` |
| `packages/api/src/file-manager.ts` | Remove copy endpoint + its two schemas; keep `config` and `list` |
| `apps/vps/src/http/file-manager.handlers.ts` | Remove the copy handler; keep the other two |
| `infra/bucket.ts` | R2 buckets + Worker via Pulumi; router origin switch; remove `dbBackupBucket` |
| `infra/cron.ts` | Remove `dbBackupCron`, `testFunction` |
| `infra/vps.ts` | Remove `dbBackupTask` |
| `packages/email/src/index.ts` | Remove backup-notification export |
| `docs/backup-feature-audit.md` | Record removal decision + provider evidence |

### Delete

`apps/vps/scripts/{backup-db,restore-db,verify-backup,run-backup-task,backup-utils}.ts` · `apps/vps/scripts/docker-restore.sh` · `apps/cron/invoke-backup-task.ts` · `packages/email/emails/backup-notification.tsx`

No frontend files are deleted. The file picker and its `packages/ui` presentational component are untouched.

AWS S3 buckets, their contents, and the AWS SDK dependency all stay — teardown is Phase 5.

## RGR TDD Test Plan

Vertical slices: one failing test, minimal code, repeat.

**Slice 1 — storage config parsing.** Red: `r2` provider without `endpoint` fails decode. Green: refinement. Then: `aws` decodes without credentials; `Redacted` values absent from `String(config)` and `JSON.stringify`.

**Slice 2 — client construction.** Red: `r2` config yields a client with the R2 endpoint and region `auto`. Green: implement layer. Then: `aws` config preserves ambient resolution; `signingClient` honors `signingEndpoint`.

**Slice 3 — `S3Service` threads the client.** Red: `S3Service` over a stub-endpoint `ObjectStoreClient` sends `uploadFile` to that endpoint. Green: thread `store`. Repeat per operation. Lock the consolidation in with a source assertion that `new S3Client(` appears exactly once in `apps/vps/src`.

**Slice 4 — copy path is gone, picker still works.** Red: `POST /api/file-manager/copy` returns 404, and no `copyFile`/`CopyObjectInput` reference remains in `apps/`, `packages/`, `infra/`. Green: delete. Then, guarding against over-deletion: `GET /api/file-manager/config` and `/list` still return their current shapes, and the picker renders a bucket dropdown from `availableBuckets`.

**Slice 4b — `listBuckets` on R2.** Red: with `provider: 'r2'`, `listBuckets` returns the configured bucket names without issuing a bucket-listing call. Green: provider-specific implementation. Then: `availableBuckets` in the config response is non-empty on R2.

**Slice 5 — contract tests against real R2** (live credentials; documented as not running in ordinary CI):
- put → head → get → delete round trip
- `listObjects` pagination past one page
- **multipart full cycle**: create → presign → PUT 3 parts (2 × 8 MiB + remainder) → `listMultipartParts` → complete → verify size
- **multipart resume**: upload part 1 → `listMultipartParts` returns exactly part 1 → upload 2,3 → complete
- **multipart abort**: create → upload part → abort → `listMultipartParts` fails
- **multipart retry**: re-PUT same part number, last write wins, complete succeeds
- **ETag parity (C2)**: the ETag the browser-equivalent PUT receives equals the one `listMultipartParts` reports. *Highest-value test in the plan* — it guards `upload.handlers.ts:313-320`.
- `checkExists` with bad credentials returns `false` (pins the wart)

No cross-bucket copy test: `copyFile` is deleted, so R2's copy semantics and size ceiling never need proving.

**Slice 6 — Worker routing, pure.** Red: `matchRoute('/user-content/a/b.jpg')` → `{ bucket: USER_CONTENT, key: 'a/b.jpg' }`. Then `/mixes/x.mp3`; `/other` → `null`; `/user-content/` edge; a key containing `/mixes/` deeper does not mis-route.

**Slice 7 — Worker HTTP semantics** (`@cloudflare/vitest-pool-workers`, seeded R2). Red: `Range: bytes=0-99` → 206, correct `Content-Range`, 100 bytes. Then: HEAD headers without body; `If-None-Match` current ETag → 304; missing key → 404; stored content-type echoed; `Env` exposes exactly two bindings (I4).

**Slice 8 — parity verification.** Red: report a mismatch on seeded divergence. Green: count/size/metadata comparison. **Not** ETag equality as the criterion — Super Slurper may change multipart boundaries. Compare content hashes on a sample.

All slices run under `bun precommit`.

## Execution Order

1. [OPS-235](https://linear.app/guidefari/issue/OPS-235/inventory-user-content-and-mixes-buckets) — **Inventory** `User_Content` and `Mixes`. Confirm the <500 MB expectation (C5); flag exceptions.
2. [OPS-236](https://linear.app/guidefari/issue/OPS-236/consolidate-13-s3client-constructions-behind-objectstoreclient) — **Consolidate**, slices 1–3, `provider: 'aws'` still selected. Zero production behavior change; ships independently. *This is the highest-value, lowest-risk PR and should land first regardless of everything downstream.*
3. [OPS-237](https://linear.app/guidefari/issue/OPS-237/delete-dead-cross-bucket-copy-path) — **Delete cross-bucket copy**, slices 4 and 4b. Independent of storage; ships separately. Small enough to fold into step 2 if convenient.
4. [OPS-238](https://linear.app/guidefari/issue/OPS-238/cdn-router-worker-and-sst-wiring-for-r2) — **Worker + SST wiring**, slices 6–7, deployed to a test hostname.
5. [OPS-239](https://linear.app/guidefari/issue/OPS-239/cut-mixes-bucket-over-to-r2) — **`Mixes` cutover.** Super Slurper copy → verify → R2 CORS → router origin → soak. No upload path, so lower risk.
6. [OPS-240](https://linear.app/guidefari/issue/OPS-240/cut-user-content-bucket-over-to-r2) — **`User_Content` cutover.** Copy → verify → R2 CORS (C4) → presigning to R2 host (C3) → router origin → soak the upload path hard.
7. [OPS-241](https://linear.app/guidefari/issue/OPS-241/remove-database-backup-subsystem-gated-on-provider-verification) — **Backup removal**, only after the provider precondition is verified and recorded.
8. [OPS-242](https://linear.app/guidefari/issue/OPS-242/consolidate-legacy-cloudfront-assets-into-r2) — **Follow-up phase: legacy CloudFront consolidation.** Copy `d20tmfka7s58bt` contents into R2, repoint the 7 hardcoded references, verify no persisted rows or historical RSS items depend on the old host, then retire the distribution. Single source, as intended.

S3 stays readable and unexpired through the rollback window.

## Risks and Open Questions

**Risks**

- **R1 (high).** Multipart ETag mismatch on R2 breaks `completeMultipartUpload` validation. Mitigated by the Slice 5 parity test before cutover.
- **R2 (high).** Missing or incorrect R2 CORS silently breaks all browser uploads. The parent doc says CORS is not needed; it is. Treated as a cutover precondition.
- **R3 (high).** Backup removal on an unverified provider guarantee. Mitigated by the precondition and by sequencing it last.
- **R4 (medium).** Presigning against the public CDN host instead of the R2 API host (C3).
- **R5 (medium).** `checkExists` masking credential errors as `false` during cutover.
- **R6 (medium).** Long-lived R2 keys replace ambient IAM. Scope per bucket.
- **R7 (low).** Over-deleting alongside the copy path would break the mix-upload and content-editing pickers. Guarded by Slice 4's positive assertions on `config` and `list`.
- **R8 (low).** `audioTable.url` is `varchar(255)`; unchanged host means unchanged lengths, but the CloudFront follow-up must re-check this ceiling.

**Open questions**

1. **Does the database provider actually deliver verified, restore-tested backups?** Blocks OPS-241 only. Everything else proceeds regardless.
2. **Does R2's multipart ETag survive the equality check at `upload.handlers.ts:313-320`?** Empirical, answered by Slice 5 in OPS-240. If not, that handler needs size-and-count validation instead — a real code change this spec has scoped but not designed.
3. **Which SST Cloudflare provider resources cover R2 buckets and Worker script bindings** at the pinned SST/Pulumi version? Resolved in OPS-238; affects how much Pulumi escape-hatch code `infra/bucket.ts` needs.
