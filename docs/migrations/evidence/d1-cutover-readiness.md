# D1 cutover readiness (OPS-249 / for OPS-250)

Updated 2026-08-10 after a read-only production snapshot rehearsal and a
throwaway deployed D1 staging rehearsal. This document does not authorize
cutover. OPS-250 remains human-only.

## Bottom line

**Not ready to cut over.** The production data migration, deployed Worker
boot, D1 binding, Durable Object, cron, and queue registration now pass in a
throwaway stage. Public API body parity, session continuity, write-load
behavior, and a Time Travel restore drill still block OPS-250.

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

1. **Public API body parity.** A 14-endpoint comparison found 6 exact matches
   and 8 body mismatches, though every endpoint returned 200 on both stacks.
   Null-versus-empty-array differences are confirmed; the remaining differences
   need endpoint-level review.
2. **Session continuity.** The Better Auth tables match structurally, but no
   live session issued by Postgres has been validated through the Worker and
   D1 adapter. The staging Worker also logs that its Better Auth base URL is
   not configured.
3. **Write serialization load test.** The navigation Durable Object serialized
   two requests, but no deployed D1 writer contention test has measured
   representative write load.
4. **D1 Time Travel restore drill.** A deployed D1 database now exists, but
   the restore drill was not attempted.
5. **Sentry transport.** The Cloudflare SDK boots, but staging has no DSN and
   no event delivery or error ingestion was verified.
6. **Reminder delivery.** The cron and queue consumer are registered, but no
   message delivery was tested because this stage has no safe email setup.
7. **Cloudflare Rate Limiting rule.** Confirm the target route has the required
   operational rule before cutover.
8. **Human cutover operations.** Freezing writes, a final delta migration, DNS,
   and unfreezing writes are OPS-250 responsibilities. None were attempted.

## Recommendation

Do not schedule OPS-250 from this evidence alone. Resolve the public API body
mismatches, then run authenticated session continuity, a safe reminder delivery
rehearsal, a deployed write-load test, and a D1 Time Travel restore. Then have
the human owner choose and rehearse the write-freeze sequence.
