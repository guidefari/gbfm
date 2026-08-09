# D1 Milestone 3 Report

Date: 2026-08-09

## Completed Local Evidence

- Generated a standalone SQLite baseline in `apps/vps/drizzle-d1` for all 43 schema tables.
- Preserved the navigation session partial unique indexes in the generated SQL.
- Added standalone trigram FTS5 indexes for audio, posts, and shows.
- Added FTS maintenance triggers for content changes and normalized tag insertion and deletion.
- Added a Miniflare D1 harness that applies the SQLite migration chain without Docker, PostgreSQL, or remote bindings.
- Verified the local harness with `bunx vitest run --config vitest.d1.config.ts`.
- The local D1 slice verifies timestamp and boolean round trips, normalized tag search, ordered tag and genre projection, partial indexes, and explicit SQLite `DESC NULLS LAST` ordering.
- The Better Auth Drizzle adapter now selects the SQLite provider.
- Added ordered `entity_labels.position` so read projections can retain the source array order.
- Added batch deletion of normalized labels for artist, album, track, music label, show, and release service deletes.
- Added normalized read projections and write replacement paths for audio, shows, posts, releases, artists, albums, music labels, and Bluesky post imports. Public `tags` and `genres` remain arrays.
- Label writes upsert labels, atomically replace entity associations, and preserve an omitted tag or genre list during partial music-label updates.
- Replaced the remaining PostgreSQL-only Drizzle APIs in health, favorites, navigation tests, and connection-pool monitoring with D1-compatible behavior.

## Validation

`bunx vitest run --config vitest.d1.config.ts` passes: 7 tests.

`bun precommit` passes.

## Deferred To M4 Or M6

- `scripts/assign-all-relations-to-user.ts` is excluded from typecheck. It is a historical PostgreSQL maintenance script and M6 must delete it or port it to D1.
- `scripts/backfill-draft-music-entities.ts` is excluded from typecheck. It is a historical PostgreSQL maintenance script and M6 must delete it or port it to D1.
- `scripts/backfill-episode-numbers.ts` is excluded from typecheck. It is a historical PostgreSQL maintenance script and M6 must delete it or port it to D1.
- `scripts/fix-mix-created-dates.ts` is excluded from typecheck. It directly uses the PostgreSQL Drizzle driver and M6 must delete it or port it to D1.
- `scripts/migrate-mixes-to-main-show.ts` is excluded from typecheck. It directly uses the PostgreSQL Drizzle driver and M6 must delete it or port it to D1.
- `scripts/migrate-users-to-better-auth.ts` is excluded from typecheck. It is a one-off PostgreSQL migration and M6 must delete it.
- `scripts/rename-audio-cdn-name.ts` is excluded from typecheck. It is a historical PostgreSQL maintenance script and M6 must delete it or port it to D1.
- `scripts/seed-music-lookups.ts` is excluded from typecheck. M4 must replace the Bun/PostgreSQL migration entry point, then M6 must delete or port this script.
- `src/runtime/services.ts`, `src/migrate.ts`, and `src/test/database.ts` retain localized compile-only PostgreSQL compatibility boundaries. M4 must replace them with the request-scoped Worker D1 composition seam and the complete Miniflare application harness. No Worker, Alchemy stack, or package rename was added in M3.
- `navigation.service.ts` retains its existing `SELECT FOR UPDATE` implementation behind two targeted TypeScript expectations. SQLite cannot provide equivalent mutual exclusion. M4 must move the serialized navigation transition to a Durable Object keyed by navigation identity; it was not weakened into a non-atomic D1 shim.
- `lock.service.ts` returns `LockUnavailable` rather than emulate PostgreSQL advisory locks on D1. M4 must replace Bluesky sync locking with durable coordination or an explicitly guarded D1 transition. This makes the missing guarantee explicit rather than silently allowing concurrent syncs.
- The full application test command still starts Testcontainers PostgreSQL. M4 must replace it with the Miniflare D1 application suite after the Worker composition seam exists.
- No production or remote database, deployment, push, rebase, or reset was used.
