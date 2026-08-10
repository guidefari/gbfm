# D1 cutover readiness (OPS-249 / for OPS-250)

Written 2026-08-10 by the agent that built `scripts/migrate-pg-to-d1.ts` and
`scripts/verify-pg-to-d1.ts`. This is an honest assessment, not a reassuring
one. **This document does not authorize cutover.** OPS-250 is human-only, and
the human should treat every "untested" line below as a real gap, not a
formality.

## Bottom line

**Not ready to cut over.** The migration transform logic is now proven
correct against every sharp type the spec names, but that proof used
synthetic data seeded specifically to exercise those cases, not production
data at production scale. The largest unresolved risk is not in this
migration script at all: it's that nobody has yet run this tool, or anything
else, against the real production database, because this environment had no
credentials to reach it.

## What this work proves

- The 52-migration Postgres chain (`apps/server/drizzle/`) bootstraps cleanly
  from an empty database, re-confirming OPS-252's fix, and produces exactly
  41 tables as the spec claims.
- `scripts/migrate-pg-to-d1.ts` correctly transforms and imports all 41
  source tables plus the `labels`/`entity_labels` fan-out into the D1 schema
  built by `apps/server/drizzle-d1/` (0000 + 0001, including FTS5 triggers,
  which fired without error on every seeded insert).
- Every sharp type named in the task is exercised and passes: uuid identity,
  timestamp-to-epoch-ms with sub-second precision, boolean-to-0/1,
  `CiphertextEnvelope` jsonb round-trip, all nine array columns fanned out
  with duplicates/unicode/empty/null handled correctly, tag/genre order
  preserved through `entity_labels.position`, and `artistNames` proven to
  stay a denormalized JSON column rather than being derived from the join
  tables.
- The migration script is idempotent: run twice in a row, the second run
  inserted zero duplicate `labels` rows and reproduced identical
  `entity_labels` rows. A targeted drift test (mutate one Postgres row,
  re-verify without re-migrating) proved the verification script actually
  detects mismatches rather than passing trivially, and a subsequent
  re-migration self-healed the drift.
- `apps/server/src/worker.ts`, `apps/server/src/durable-objects/navigation-lock.do.ts`,
  and `alchemy.run.ts` all exist in the working tree with a complete resource
  list (D1, two R2 buckets, KV, a Queue, the `NavigationLock` Durable Object,
  and the Worker itself with a cron trigger). This is further along than
  `d1-status.md` and `m4-handover.md` describe — those documents predate the
  commits currently on `prod` (`fix(vps): use Cloudflare Sentry in worker`,
  `feat(vps): replace navigation FOR UPDATE lock with a Durable Object`,
  `chore(server): rename apps/vps to apps/server`). Whoever reads this next
  should treat `d1-status.md` as stale on the M4 question and check `git log`
  directly.
- `cd apps/server && bunx vitest run --config vitest.unit.config.ts`: 401
  passed, 0 failed.
- `cd apps/server && bunx vitest run --config vitest.d1.config.ts`: 7 passed,
  0 failed.
- `cd apps/server && bunx tsgo --noEmit`: exactly the 5 known pre-existing
  errors (`scripts/verify-production-deployment.ts` x2,
  `src/services/crypto.service.ts` x2, `src/services/s3.service.ts` x1), no
  new errors introduced by this work.

## What this work does not prove

### No production data was read

This environment had no `.env`, no configured `sst`/`alchemy` secrets, and no
way to reach `vps.goosebumps.fm`'s database. Per the task's explicit
fallback instructions, a synthetic local Postgres clone was built instead and
seeded by hand with rows chosen to exercise every sharp type. This is real
evidence that the transform logic is *correct*, but zero evidence about:

- **Production row counts and D1's 10 GB limit.** `postgres-to-d1.md` states
  this was never measured even at the M1 stage ("Production database size
  and peak write rate. No agent had or sought production access. This needs
  a human before cutover"). That is still true today. Someone with
  production access must run `SELECT pg_database_size(...)` (or equivalent)
  and compare against D1's cap before this migration is attempted for real.
- **Production data shapes this seed did not anticipate.** Malformed or
  historical timestamp formats, unexpectedly large jsonb blobs, empty-string
  array elements, `NULL` bytes or unusual unicode in text fields, orphaned
  foreign keys already present in production (this migration assumes the
  source is referentially clean; it does not check that assumption), or rows
  written by since-removed application code paths. The seed used here is
  representative of the *documented* schema, not of *production's actual
  history*.
- **Write volume/performance at scale.** The migration inserts in batches of
  100 statements via `db.batch()`. This was only ever exercised against a
  few dozen total rows. Whether that batch size is efficient — or even
  correct under D1's real latency and any per-request limits — at tens or
  hundreds of thousands of rows is unverified.
- **The actual `pg_dump`/`pg_restore` path.** The task pointed at
  `git show 2bafe3e1^:apps/vps/scripts/backup-db.ts` and friends as reusable
  export logic. This migration script does not use them: it connects to
  Postgres directly via the `pg` client and streams rows with a plain
  `SELECT`, which is simpler and was sufficient for a database this task
  never got to size. If production turns out to be large enough that a
  single-connection row-by-row export is impractical, that logic is still
  sitting in history, unrecovered and unintegrated.

### FTS5 and ordering, not re-verified here

- **FTS5 trigram search fixture.** M1 captured a search-results fixture from
  real Postgres `ILIKE` behavior specifically so the FTS5 rewrite would have
  a pass/fail criterion (`d1-search-fixture.md`, referenced but not read in
  depth by this task). This migration verified that FTS triggers *fire*
  without erroring on insert, which is necessary but not sufficient — it
  does not confirm search results match the fixture after a real migration.
- **`DESC NULLS LAST` ordering.** Named explicitly in the spec's M3 test plan
  (slice 7) as something to verify against a fixture containing nulls. Out
  of scope for this M5 script and not re-checked here.

### Batch atomicity under real failure

Every statement in every test batch succeeded. Nothing forced a mid-batch
failure to confirm D1's `batch()` actually rolls back atomically the way the
spec's design constraints assume ("D1 has no interactive transactions. Only
`batch()`: an ordered atomic statement array with no mid-batch reads"). This
is a documented platform guarantee, not something this task independently
re-verified.

### The rest of the M5/cutover gate, per the spec

`postgres-to-d1.md`'s M5 gate is: "slices 14-15 green; counts and checksums
match; sessions survive; write-path load test shows no contention; D1 Time
Travel restore drill succeeds." This work satisfies slice 14 (counts and
checksums match) against synthetic data. It does not touch:

- **Slice 15**: "a full black-box API suite run against the migrated staging
  stack matches the same suite run against production." No staging stack was
  deployed (forbidden by this task's constraints — no `alchemy deploy`,
  `wrangler deploy`), so this cannot have run.
- **Sessions survive.** Better Auth session validity across the cutover
  (`account`/`session`/`verification` rows migrate structurally correctly in
  this work's tests, but nobody has confirmed a live Better Auth session
  issued against Postgres still validates when the same row lands in D1).
- **Write-path load test.** Not attempted; would require a deployed staging
  Worker, which this task forbids.
- **D1 Time Travel restore drill.** Requires a real, deployed D1 database.
  Not attempted.
- **Bundle size after the Sentry Cloudflare SDK swap.** `d1-bundle-size.md`'s
  2.56 MiB figure explicitly excludes `@sentry/cloudflare`'s actual weight
  (`m4-handover.md`: "the 2.56 MiB figure... explicitly excluded... This
  measurement closes that gap and is the number that matters"). Whether that
  re-measurement happened after the Sentry swap commits landed was not
  checked as part of this task; confirm before relying on the bundle fitting.
- **Cloudflare Rate Limiting rule.** `postgres-to-d1.md` flags this as an
  "Operational gap: nothing enforces a request limit between this commit and
  the day a Cloudflare Rate Limiting rule is actually configured for this
  zone/route. That rule must be created before cutover, not after." Not
  addressed by this task; confirm it exists before cutover.

## Specific risks worth naming plainly

1. **Unknown production size vs D1's 10 GB cap.** Highest-priority unknown.
   If production is larger than fits comfortably, this entire approach needs
   revisiting before OPS-250, not discovered during it.
2. **This script has never touched a real network-latency D1 (only local
   Miniflare).** Miniflare's D1 emulation is high-fidelity but is not the
   same as a deployed database with real network round-trips. Batch timing,
   retry behavior under contention, and any Workers-specific limits (CPU
   time per request, subrequest limits) are unmeasured.
3. **The transform assumes referentially clean source data.** If production
   Postgres has any orphaned foreign key (possible after years of ad-hoc
   scripts — several are excluded from typecheck specifically because
   they're "historical maintenance scripts"), this migration will still
   import the orphan rather than catch it, because it copies rows, it
   doesn't validate Postgres-side integrity before doing so. The
   verification script's referential-integrity checks run *after* import
   and would catch the D1-side orphan, but only for the 17 relationships
   explicitly listed in `verify-pg-to-d1.ts`'s `REFERENTIAL_CHECKS` — not an
   exhaustive check of every foreign key in the schema.
4. **No rehearsal of the real cutover sequence** (freeze writes, final delta
   export, import, verify, repoint DNS, unfreeze) described in the spec's M5
   milestone. This task built and proved the export/transform/import/verify
   tool; it did not rehearse the operational sequence around it.

## Recommendation

Before OPS-250:

1. Get read-only production database credentials into an environment that
   can run this migration and verification script directly against
   production (or a `pg_dump`/`pg_restore` clone of it), and re-run both.
   Treat any row-count or checksum mismatch as a blocker, not a curiosity.
2. Measure production database size and compare against D1's 10 GB cap.
3. Run the M5 slice 15 black-box API suite against a real deployed staging
   Worker + D1 (requires lifting this task's no-deploy constraint, which is
   appropriate for a human to decide, not this agent).
4. Confirm a live Better Auth session survives the migration end to end.
5. Re-measure the Worker bundle size after the Sentry Cloudflare SDK swap and
   confirm it's under the 3 MiB Cloudflare paid-plan limit.
6. Confirm the Cloudflare Rate Limiting rule exists for the target zone/route.
7. Rehearse a D1 Time Travel restore.
8. Only then: freeze writes, final delta migration, verify, repoint DNS.
