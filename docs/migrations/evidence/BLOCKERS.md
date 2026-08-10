# Migration Blockers

## 2026-08-09: Bundle gate interpretation changed concurrently

Commit `6c8dc959` changed `d1-bundle-size.md` after the current-Bun graph
measurement to define the gate as the future ported graph. The two measurements
answer different questions:

- Current HTTP graph: 3,907,876 gzipped bytes, which does not fit.
- Ported graph after externally excluding planned M3/M4 removals: 2,684,671
  gzipped bytes with MDX precompiled, which fits.

The later commit's ported-graph conclusion is retained as the bundle gate
verdict. It excludes the replacement Cloudflare Sentry SDK, so M4 must bundle
the actual Worker entry after that SDK is wired. The 256 KiB MDX-retained margin
is not sufficient evidence that the final production Worker will fit.

## 2026-08-09: Migration chain lacks its initial SQL migration

Applying `apps/vps/drizzle/*.sql` to an empty local PostgreSQL 17 database
fails in `0001_absent_vulcan.sql` because it drops `mixes_slug_idx` and
`posts_slug_idx`, but the migration that creates `mixes` and `posts` is absent.
`drizzle/meta/0000_snapshot.json` is tracked and records that missing baseline.

The local fixture uses a generated, throwaway bootstrap from that tracked
snapshot, then applies every tracked SQL migration. This is sufficient for the
M1 behavioral fixture but is not a clean migration bootstrap. M3/M5 need a
durable initial migration or a documented baseline procedure before a fresh D1
environment can be created reproducibly.

The reconstructed baseline exposed a second clean-bootstrap defect:
`0013_curvy_adam_warlock.sql` drops `users` with `CASCADE`, which already drops
the two referenced foreign keys, then attempts to drop those same constraints.
Postgres stops at the first missing constraint. The M1 fixture omits only those
two redundant `DROP CONSTRAINT` statements and applies all remaining tracked
SQL. This exception must be removed by repairing the migration history, not
carried into the D1 migration toolchain.

## 2026-08-09: Tag and genre normalization design is incomplete

The M3 instruction requires all seven source `varchar[]` declarations to be
normalized, except `artistNames`, and names only `tags`, `audio_tags`,
`post_tags`, and `show_tags` as the replacement design. Those join tables
cannot represent `music_artists.genres`, `music_albums.genres`,
`music_labels.tags`, or `music_labels.genres`; `releases.tags` is also inherited
from the shared content fields but has no named join table. The current API
schemas expose these fields as arrays.

M3 needs an approved table and API projection design for genres and the label
and release tag surfaces before their array columns can be removed safely.

**RESOLVED 2026-08-09.** The halt was correct: the spec named only
audio_tags/post_tags/show_tags and omitted `releases.tags` and all four `genres`
columns. There are 9 array columns across 8 tables, and `tags` arrives via the
`defaultContentFields` spread rather than being declared per table.

Approved design is now in `postgres-to-d1.md` under "Tags: array column to join
table": a shared polymorphic `labels(kind, name)` + `entity_labels(entity_type,
entity_id, label_id)` pair, rather than six per-table join tables. Committed in
`227ed2e9`. M3 may proceed.

## 2026-08-09: M2 database composition remains PostgreSQL-bound

`apps/vps/src/runtime/services.ts` still imports the module-level `pg.Pool` from
`db/index.ts` and constructs `DatabaseLayer(pool)`. Local D1 can only be supplied
at a Worker or test composition seam, neither of which exists yet. M3 can translate
the schema and local test harness, but its D1 client cannot replace the production
runtime layer without beginning M4's Worker composition work. This must be resolved
when the Worker request scope is introduced; do not route a D1 binding through the
current module-level runtime.

## 2026-08-09: M3 transaction and composition gate

The D1 layer exposes `DrizzleD1Database`, which intentionally has `batch()` but
no interactive `transaction()`. The category A and B transaction sites now use
ordered D1 batches and guarded retries. The category C navigation call at
`apps/vps/src/services/navigation.service.ts:413` is intentionally unchanged,
per the classification, until M4 provides a Durable Object keyed by navigation
identity. It cannot typecheck against the D1 client without either converting it
to an unsafe non-atomic shim or starting M4 work.

The current `apps/vps` runtime still constructs its layer from a PostgreSQL pool.
M2 explicitly records that a D1 binding cannot enter this runtime until the M4
Worker composition seam exists. Replacing the full Docker-dependent test suite
with D1 before that seam would either skip the application integration tests or
alter the current production composition.

The local M3 Miniflare migration harness and focused schema slices are complete,
but the full M3 gate cannot be truthfully marked complete until the following are
implemented together:

- normalized tags and genres write/read projections across content and music entity services;
- the M4 navigation Durable Object or an explicitly approved alternative;
- request-scoped Worker D1 composition replacing the PostgreSQL pool test setup.

## 2026-08-10: M4 worker.ts cannot load the full AppLayer while SentryServiceLayer imports @sentry/bun

`runtime/services.ts`'s `BaseServicesLayer` provides `SentryServiceLayer` to
nearly every other service, and `sentry.service.ts` imports `@sentry/bun` at
module scope. `@sentry/bun`'s ESM entry re-exports `@sentry/node`
wholesale (`onUncaughtExceptionIntegration`, `httpIntegration`,
`postgresIntegration`, and other Node-runtime-only integrations), which is the
exact swap this spec's M4 file table defers to a later slice ("the
`@sentry/bun` swap. Later slices.").

This worker.ts slice wires the full `AppLayer` (parametrized on `Database`
only, per the M4 db-composition blocker above, now resolved) because
`http/routes.ts`'s `Api` groups depend on nearly every service in
`BaseServicesLayer`, and `SentryServiceLayer` is not separable from it without
touching every consuming service -- out of this slice's scope. So `worker.ts`
currently imports `@sentry/bun` transitively through `AppLayer`.

Whether this actually breaks at Worker bundle/runtime is unverified: this task
explicitly forbids `alchemy dev`/`wrangler dev`/any real deploy, so the
bundler was never run against `worker.ts`. If `@sentry/bun` fails to bundle or
initialize under `workerd`, the Cloudflare Sentry SDK swap (already scoped as
a separate slice) needs to land, or become a dependency, before this worker.ts
can serve real traffic. Flagging now so the swap isn't scheduled after a
deploy attempt already failed on it.

## 2026-08-09: M4 package rename collides with an existing workspace package

HALT-CHAIN: `packages/api/package.json` already owns `@gbfm/api`, while
`apps/vps/package.json` depends on it and exports the database schema types that
`apps/www` consumes as `@gbfm/vps/schemas`. Renaming the application package to
`@gbfm/api` creates duplicate workspace package names and makes the required
typecheck ambiguous. The migration specification needs a human-approved package
boundary decision before the mechanical rename and all later M4 work can proceed.
