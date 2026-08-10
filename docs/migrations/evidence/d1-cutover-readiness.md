# D1 cutover readiness (OPS-249 / for OPS-250)

Updated 2026-08-10 after a read-only production snapshot rehearsal, a
throwaway deployed D1 staging rehearsal, a redeploy-and-reverify pass, and
four pre-cutover drills. This document does not authorize cutover. OPS-250
remains human-only.

## Bottom line

**Not ready to cut over.** Public API shape/content parity is now resolved:
11 of 14 endpoints match exactly, and the remaining 3 have zero real content
differences once compared by id (only an accepted history-loss edge case, an
accepted FTS5-ranking difference, and an ordering difference that is an
artifact of production still running old code). Session issuance and
validation work. But this pass surfaced two new, real blockers: a
concurrent-write failure rate of roughly 30-40% against a representative
write path, and a Cloudflare-edge-level outage lasting over 20 minutes on
the deployed Worker immediately following a D1 Time Travel restore. Both are
serious enough to block OPS-250 on their own.

## Now proven

- Production Postgres was accessed read-only through `sst shell --stage=prod`.
  A custom `pg_dump` was written only under `/tmp`, restored into a throwaway
  local Postgres, and deleted after this rehearsal. No production writes or DDL
  were run.
- [`d1-database-sizing.md`](d1-database-sizing.md) records a 13,604,543-byte
  production database, or 12.97 MiB. That is 0.136% of D1's 10 GB cap. The
  largest application relation is `music_entity_links` at 499,712 bytes and
  838 rows. The database is comfortably below the cap.
- The final local run migrated all 41 source tables and their normalized labels
  from the production snapshot. [`d1-migration-verification.md`](d1-migration-verification.md)
  records matching counts and SHA-256 content checksums for every table.
- The source snapshot contained 10 parent-post links, 10 root-post links, and
  two quoted-post links. The original UUID ordering could insert a child before
  its referenced post, causing a D1 foreign-key failure. The migrator now
  topologically orders each self-referential `posts` row before batching it.
- The first production run exposed a target schema mismatch in
  `music_entity_links`. The D1 uniqueness index used `(entity_type, platform,
  url)`, while production uses `(entityType, entityId, platform)`. It silently
  replaced 53 distinct rows, producing 785 D1 rows from 838 source rows. The
  D1 schema and baseline now use the source uniqueness key. The final count and
  checksum both match at 838 rows.
- The verification script no longer assumes synthetic fixture UUIDs or emits
  row values. It checks all user UUIDs, timestamps at epoch-millisecond
  precision, booleans, every available CiphertextEnvelope, all nine array
  columns and their `entity_labels.position` order, and both denormalized
  `artistNames` columns. The final snapshot run passed every check.
- The 17 named relationship checks passed, and `pragma foreign_key_check`
  returned zero violations, covering every D1 foreign key.
- The FTS5 trigram fixture passes locally, including mid-word, tag,
  case-insensitive, empty-query, and punctuation cases. The full five-row
  `DESC NULLS LAST` fixture also passes with the SQLite null-order expression.
- A local Miniflare D1 test forces a duplicate-key failure in the second
  statement of a `batch()`, asserts rejection, then proves the first insert was
  rolled back. This closes the local batch-atomicity gap.
- The throwaway `d1-staging` Worker booted on workers.dev. `/health/live` and
  `/health/ready` both returned 200, and a public shows read returned 200 from
  the deployed D1 binding.
- A real same-identity Durable Object rehearsal serialized two concurrent
  navigation requests into trail positions 1 then 2. The cron is registered,
  and the reminders queue has one Worker consumer.
- A fresh read-only production snapshot was imported into deployed staging D1.
  The local source-to-D1 verification passed all 41 tables, checksums, fan-outs,
  relationship checks, foreign-key checks, and sharp-type checks.
- The actual deployed JavaScript modules measure 2,004,627 gzipped bytes,
  1.91 MiB. This is below the earlier 2.56 MiB estimate.
- The deployed Worker imports and wraps requests with `@sentry/cloudflare`
  without a Node-only startup crash. Its throwaway configuration has no Sentry
  DSN, so transport delivery remains unverified.

- The staging Worker was redeployed after the null-for-empty labels fix and a
  new tie-break-ordering fix. 11 of 14 public endpoints now match production
  exactly, byte for byte. The remaining 3 (`/api/content/posts`,
  `/api/content/posts/micro`, `/api/music/labels`/`/api/music/tracks`/part of
  `/api/profile/:username`) have zero real content differences when diffed
  by id across every row -- what's left is one accepted, unrecoverable
  `[]`-vs-`null` history-loss row, and an ordering difference caused by
  production still running pre-fix code. `/api/search` remains an accepted
  FTS5-vs-ILIKE ranking difference.
- The `user.createdAt` 2-hour offset was root-caused: `node-postgres`
  parses `timestamp without time zone` columns using the *migration
  process's local OS timezone*, not UTC. It is not a one-row artifact (it
  is systemic to every row read that way) but it is not a data-integrity
  problem either -- the stored bytes are correct. Fixed with a custom `pg`
  type parser in the migration script; re-verified against all 19
  production `user` rows with zero drift after the fix, then re-imported
  into staging D1 and confirmed live via the API.
- A throwaway Better Auth account was created directly against the deployed
  staging Worker (sign-up, not migrated from production). Sign-up, sign-in
  rejection of bad credentials, and `get-session` all returned correct
  results, and the session row persisted in D1 and validated repeatably
  across multiple requests. Session continuity is proven at the
  mechanism level; the "no base URL configured" log warning appears
  cosmetic given everything else worked.
- A concurrent write-load test against `POST /api/favorites` /
  `DELETE /api/favorites/:audioId` (20-way concurrency, 5 rounds, 200
  requests total) found roughly 30-40% of writes fail under contention on
  the same handful of rows, split between `409` (expected conflict
  responses) and `500`/`503` (uncaught errors with empty response bodies).
  No partial/corrupted state was left behind in either run -- writes either
  fully succeeded or fully failed -- but the failure rate itself is a new,
  real blocker.
- A D1 Time Travel restore was exercised end to end: captured a bookmark,
  wrote a canary row, restored to the bookmark, and confirmed the canary
  was gone with `PRAGMA foreign_key_check` returning zero violations. The
  database-level restore mechanism works correctly. But the deployed
  Worker's request path then returned Cloudflare edge error 1102 (`Worker
  exceeded resource limits`) on roughly 30-70% of requests, oscillating,
  for over 20 minutes afterward -- through two forced redeploys -- while
  direct `wrangler d1 execute` queries against the same database succeeded
  100% of the time throughout. Root cause not identified. No active
  Cloudflare status-page incident was found for Workers, D1, or the WEUR/EU
  region at the time.

See [`d1-staging-rehearsal.md`](d1-staging-rehearsal.md) for commands and raw
check outcomes.

## Rehearsal timing

| Step | Duration |
| --- | ---: |
| Read-only production `pg_dump` | 32.000 s |
| Local throwaway Postgres restore | 0.718 s |
| Local D1 migration | 2.191 s |
| Local D1 verification | 0.984 s |
| Total | 35.893 s |

This is a local rehearsal, not a valid production write-freeze estimate.
Miniflare does not measure deployed D1 latency, nor does it include the final
delta export, operational approvals, or the human DNS decision. It establishes
that data volume is not the limiting factor. OPS-250 must measure a deployed
rehearsal before choosing a freeze window.

## Production write rate

The available read-only PostgreSQL counters have no known reset time, so they
cannot yield a peak or a rate. At measurement they showed 227,371 committed
transactions and 3,589 database-level tuple writes, but those are cumulative.
The required D1 write-path load test remains open. See the sizing evidence for
the complete aggregate-only measurement and its limits.

## Still open and blocking

1. **Concurrent write failure rate.** Roughly 30-40% of concurrent writes to
   the same rows via `POST /api/favorites` failed with `500`/`503` (empty
   bodies, uncaught) rather than a clean, structured conflict response. D1
   serializes writes; this application's check-then-insert pattern in
   `favorite.service.ts` (and likely similar patterns elsewhere) does not
   handle that serialization gracefully under contention. This needs a fix
   (retry-on-busy, a queued/transactional write path, or at minimum mapping
   the underlying D1 error to a structured 409/503 instead of an uncaught
   500) and a re-run of this drill before cutover.
2. **Post-restore Worker instability.** The D1 Time Travel restore itself
   works and leaves the database intact, but the deployed Worker's request
   path took over 20 minutes to fully stabilize afterward, with a
   fluctuating 30-70% failure rate (Cloudflare edge 1102) even through two
   forced redeploys, while direct D1 queries stayed 100% reliable the whole
   time. If Time Travel is ever needed as a real disaster-recovery path
   in production, this means the recovery window must budget for double-digit
   minutes of continued instability after the data itself is back, not
   near-instant availability. Root cause not identified; needs investigation
   before this can be treated as a viable production DR path.
3. **Sentry transport.** The Cloudflare SDK boots, but staging has no DSN and
   no event delivery or error ingestion was verified.
4. **Reminder delivery.** The cron and queue consumer are registered, but no
   message delivery was tested because this stage has no safe email setup.
5. **Cloudflare Rate Limiting rule.** Confirm the target route has the required
   operational rule before cutover.
6. **Avatar multipart upload.** The portable filesystem layer's compatibility
   with the existing avatar upload path was not exercised.
7. **`profile.service.ts` ordering.** Editorials/tweets ordering still has no
   secondary sort key (the OPS-249 fix only covered the five named
   `music-entity` call sites). Low severity given the null-content parity
   already holds, but still an open, known gap.
8. **Human cutover operations.** Freezing writes, a final delta migration, DNS,
   and unfreezing writes are OPS-250 responsibilities. None were attempted.

## Recommendation

Do not schedule OPS-250 from this evidence. Public API parity and session
continuity are resolved. But the concurrent-write failure rate and the
post-Time-Travel Worker instability are new, real findings from this pass
that did not exist in the prior readiness assessment, and either one alone
is a legitimate blocker: the first means real concurrent users will see
avoidable 500s under ordinary load, and the second means the documented
disaster-recovery path leaves the site substantially degraded for over 20
minutes after data is restored. Fix and re-verify both, then run a safe
reminder-delivery rehearsal and confirm the Rate Limiting rule. Then have the
human owner choose and rehearse the write-freeze sequence.

## Staging stack (leave running, do not tear down)

- Worker: `https://gbfm-api-d1-staging-mebtavpzy2m53eso.guideg6.workers.dev`
- D1: `gbfm-Database-d1-staging-hjxg2lbeiirvov2u`

Teardown command (do not run without explicit human authorization):

```sh
bunx alchemy destroy --stage d1-staging --yes
```
