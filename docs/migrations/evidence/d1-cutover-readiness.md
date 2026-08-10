# D1 cutover readiness (OPS-249 / for OPS-250)

Updated 2026-08-10 after a read-only production snapshot rehearsal. This
document does not authorize cutover. OPS-250 remains human-only.

## Bottom line

**Not ready to cut over.** The production data migration and the local D1
checks now pass, and the D1 size risk is closed. The remaining gates require a
deployed Worker and D1 database, which this task was forbidden to deploy or
operate. They include session continuity, a black-box staging run, write-load
behavior, and a Time Travel restore drill.

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

1. **Deployed D1 behavior and cutover rehearsal.** This run used local
   Miniflare. It does not measure network latency, Workers request limits,
   deployed D1 batch behavior, or final-delta handling.
2. **M5 slice 15.** No black-box API suite has compared a migrated staging
   Worker with production. Deploying staging was forbidden here.
3. **Session continuity.** The Better Auth tables match structurally, but no
   live session issued by Postgres has been validated through the Worker and
   D1 adapter.
4. **Write serialization load test.** No deployed write-path contention test
   has measured D1's serialized writer under representative load.
5. **D1 Time Travel restore drill.** It requires a deployed D1 database and
   was not attempted.
6. **Final Worker bundle measurement.** The existing measurement predates the
   actual Cloudflare Sentry SDK graph and must be repeated against the Worker
   entrypoint.
7. **Cloudflare Rate Limiting rule.** Confirm the target route has the required
   operational rule before cutover.
8. **Human cutover operations.** Freezing writes, a final delta migration, DNS,
   and unfreezing writes are OPS-250 responsibilities. None were attempted.

## Recommendation

Do not schedule OPS-250 from this evidence alone. First deploy and rehearse the
staging Worker with a fresh production snapshot, run the black-box suite and
session-continuity check, load-test writes, repeat the bundle measurement, and
run a D1 Time Travel restore. Then have the human owner choose and rehearse the
write-freeze sequence.
