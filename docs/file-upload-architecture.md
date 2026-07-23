# File Upload Architecture

This note separates safeguards already in gbfm from the target direct-upload design. Implementation work is tracked separately.

## Implemented Current State

gbfm stores media in S3 and serves it through the `cdn.goosebumps.fm` SST router. Audio multipart upload is authenticated and resumable, but it is still proxied: each 8 MiB browser chunk passes through API Gateway and the VPS before `UploadPart` sends it to S3. Browser checkpoints support reconciliation, retry, pause, resume, and cancel.

The current proxied multipart path now enforces a declared-size contract:

- Init accepts the exact expected total size, embeds it in the user-scoped object-key contract, and stores it as S3 `expected-size` metadata.
- Part upload derives the valid part count and exact length of every part from that size. It rejects an out-of-range part number or a part whose length differs, including the final part.
- Completion calls `ListParts` and requires the exact contiguous part count, exact per-part sizes, and ETags matching the submitted completion request.
- Completion checks `HeadObject` first. A retry replays success only when object size and `expected-size` metadata match.
- If `CompleteMultipartUpload` returns an ambiguous error, `HeadObject` reconciles it as success only under the same size and metadata checks.
- New audio create requests carry one actor-scoped idempotency key across retries. A database uniqueness constraint and transaction replay the existing audio record rather than creating a duplicate; audio and creator links are inserted atomically.
- The mix upload UI now propagates the Save Draft choice into the create/update payload.

These checks improve the current proxy path; they are not direct-upload signing and there is no persisted `upload_asset` model yet. The unauthenticated legacy `POST /api/upload/file` endpoint also remains available for simple audio/image uploads.

### Canonical Draft Policy

The fixed public policy is `draft = false` at every anonymous read boundary. The audited route matrix is:

| Surface | Covered content | Current behavior |
| --- | --- | --- |
| Canonical detail and lists | audio, shows, posts, labels, releases | Drafts return 404 or are omitted |
| Nested and taxonomy reads | show episodes, label releases, audio/post tags | Draft children and draft-derived tags are omitted |
| Discovery | search, profiles, user content, slug resolve | Drafts are omitted |
| Distribution | share routes, RSS, sitemap, mix notification lookup | Drafts are omitted |
| Authenticated audio edit read | audio | Assigned creator or admin may read a draft; anonymous requests are rejected |

Black-box coverage asserts canonical detail/list, share, tag, nested episode/release, RSS, and unauthenticated edit behavior. Named preview grants and a complete shared authorization policy do not exist yet.

## Target Direct Upload

Preserve the current workflow while moving all audio and image bytes off the application path:

```text
Browser                 gbfm API                         S3
   | POST init              | Create upload_asset + MPU   |
   |----------------------->|---------------------------->|
   | POST sign part         |                             |
   |----------------------->| authorize and presign       |
   |<-- short-lived URL ----|                             |
   | PUT exact chunk directly -------------------------->|
   | POST complete          | ListParts, complete, verify |
   |----------------------->|---------------------------->|
   |<-- replayable success -|                             |
```

Init must persist the authenticated owner, bucket/key, content type, exact expected total size, fixed chunk size, exact expected part count, checksum contract, multipart upload ID, and expiry. The server remains the authority for key generation.

Part signing must load that record and require `state = pending`, the same owner, an unexpired session, the exact upload ID/key, an integer part number in `1..expected_part_count`, and the exact expected content length for that part. The signed `UploadPart` capability must bind bucket, key, upload ID, part number, content length, checksum header/value, and a short expiry. Do not accept a client-selected length or count. Configure S3 CORS only for deployed origins and `PUT`, and expose `ETag` plus required checksum headers.

Completion is a trust boundary. Before completing, call `ListParts` and require exactly the expected contiguous parts, expected length per part, submitted/S3 ETag agreement, and the selected checksum contract. After completion, call `HeadObject` and require final size, final checksum, content type, and immutable upload metadata to match `upload_asset`. Only then transition to `uploaded` and return success. If completion or its response is ambiguous, reconcile with `HeadObject`; retries in `uploaded` or `attached` replay the same successful result. A mismatched existing object is a hard conflict, never success.

## Upload Asset Lifecycle

Target schema, not currently implemented:

```text
upload_asset
id, owner_user_id, bucket, object_key, content_type
expected_size, part_size, expected_part_count, checksum_algorithm, checksum
multipart_upload_id, state: pending | uploaded | attached | expired
attached_content_type, attached_content_id
created_at, expires_at, uploaded_at, attached_at
```

All transitions use a row lock or conditional update and enforce owner, current state, and expiry:

- `pending -> uploaded`: completion verification succeeds. A concurrent/retried completion observes `uploaded` and replays success.
- `pending -> expired`: cleanup claims an expired row, then aborts the multipart upload. An already-completed object is inspected and either reconciled to `uploaded` or deleted if it cannot satisfy the contract.
- `uploaded -> attached`: one database transaction locks the asset, verifies owner and `uploaded` state, creates the content and creator links, records the asset reference on that content, and marks the asset `attached`.
- `uploaded -> expired`: cleanup claims an unattached expired row and deletes the verified object. Delete retries must be safe; the claimed row remains non-attachable.
- `attached` and `expired` are terminal. An asset can attach once and cannot be attached across owners.

Content create must use an actor-scoped idempotency key bound to the asset ID and a request fingerprint. A retry with the same actor/key/fingerprint returns the committed content and attachment; reuse with a different asset or payload is a conflict. This extends the implemented audio-create idempotency so an ambiguous client response cannot duplicate content or attach an asset twice.

Use an S3 lifecycle rule as a backstop for stale multipart uploads, plus an application cleanup job for expired `pending` rows and expired, unattached `uploaded` objects. Record cleanup attempts and outcomes so S3/database divergence can be retried and audited. Keep unattached uploads resumable for 30 days; same-browser resume remains in scope and cross-device resume remains out of scope.

## Draft Delivery And Pilot Gate

Application filtering alone does not protect media bytes. Published media may keep stable CDN URLs, but draft object keys must not be reachable through an unsigned CloudFront URL. After applying the creator/admin/named-preview policy, the API should issue a short-lived signed CloudFront URL or cookie; origin access remains private.

Secure signed CloudFront draft delivery is a prerequisite for the Far End pilot, not follow-up work. The pilot must prove one episode's audio and artwork through direct upload, transactional draft attachment, pause/resume and retry recovery, exclusion from every public surface, authorized creator/admin access, anonymous and ordinary-user denial at both metadata and media layers, cleanup behavior, and publication without re-uploading. Upload remaining episodes through the normal UI only after that deployed proof succeeds.

## Scope Decisions

- Cover all user-uploaded audio and images; retire `/api/upload/file` after callers migrate.
- Keep `draft` as visibility state. Model future scheduling separately with nullable `publishAt`.
- Default draft viewers are assigned creators and admins. Named show/item preview grants are additive follow-up policy work, but the pilot's intended viewers must be supported before it runs.
- Persist server-side upload lifecycle while retaining browser checkpoints.
- Resolve final key layout, checksum algorithm, one-at-a-time versus batched signing, and XHR/fetch progress transport during implementation without weakening the contracts above.
