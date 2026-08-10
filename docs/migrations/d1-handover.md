# Postgres → D1 Migration: Handover (M0 → M5)

Written 2026-08-10. Covers all work from the tech-spec through the staging rehearsal.
**Cutover has not happened.** Production still runs on PlanetScale Postgres via the Bun/ECS service.

---

## TL;DR

| | |
| --- | --- |
| Milestones done | M1–M5 (design, schema, data tooling, Workers port, staging rehearsal) |
| Milestone remaining | M6 cutover (OPS-250), human-gated |
| Branch | `prod`, ~50 commits ahead of `origin/prod`, unpushed |
| Staging | `https://gbfm-api-d1-staging-mebtavpzy2m53eso.guideg6.workers.dev` (throwaway, still up) |
| Cutover verdict | **Not ready.** 5 open items, see [Cutover gate](#cutover-gate) |
| Production writes performed | None. Read-only access only, throughout. |

---

## What changed, in one paragraph

`apps/vps` (Bun + Hono + node-postgres, running on ECS) became `apps/server`
(Cloudflare Worker + Drizzle SQLite + D1). Along the way the Bun-specific runtime
disappeared: no process loops, no graceful-shutdown handler, no in-process rate
limiter, no `FOR UPDATE` row locks, no SSE. Their Workers-native replacements are
Durable Objects, Queues, KV, Cron Triggers and a Cloudflare rate-limiting rule
(the last one is still unbuilt, OPS-256). Infrastructure moved from SST to
Alchemy V2 in `alchemy.run.ts`; SST still owns DNS, ECS and S3 until cutover.

---

## Linear issues

Parent: **[OPS-244](https://linear.app/issue/OPS-244)** — Postgres → D1 migration

### Milestones

| Issue | Milestone | State |
| --- | --- | --- |
| [OPS-245](https://linear.app/issue/OPS-245) | M1 — audit and gate | Done |
| [OPS-246](https://linear.app/issue/OPS-246) | M2 — transaction classification | Done |
| [OPS-247](https://linear.app/issue/OPS-247) | M3 — schema translation to SQLite | Done |
| [OPS-248](https://linear.app/issue/OPS-248) | M4 — Workers port | Done |
| [OPS-249](https://linear.app/issue/OPS-249) | M5 — data migration + staging rehearsal | Done |
| [OPS-250](https://linear.app/issue/OPS-250) | M6 — **cutover** | **Open, human-only** |

### Spun out during the work

| Issue | What | State |
| --- | --- | --- |
| [OPS-251](https://linear.app/issue/OPS-251) | Navigation debounce | Open |
| [OPS-252](https://linear.app/issue/OPS-252) | Migration chain bootstrap repair | Done |
| [OPS-253](https://linear.app/issue/OPS-253) | Alchemy typecheck errors (5 known) | Open |
| [OPS-254](https://linear.app/issue/OPS-254) | 66 unit tests silently skipped since M3 | Done |
| [OPS-255](https://linear.app/issue/OPS-255) | Full Alchemy migration (retire SST) | Open, after cutover |
| [OPS-256](https://linear.app/issue/OPS-256) | Cloudflare rate-limiting rule | Open, user-owned |
| [OPS-257](https://linear.app/issue/OPS-257) | Error 1102 CPU limit on boot | Done |
| [OPS-258](https://linear.app/issue/OPS-258) | Concurrent-write contention on favorites | Done |
| [OPS-259](https://linear.app/issue/OPS-259) | Spotify import duplicate race | Done (guard); dedupe deferred |

---

## Milestone detail

### M0 — Spec

`docs/migrations/postgres-to-d1.md` (38K). Written to the `tech-spec` outline.
Scope decisions taken during authoring, all user-directed:

- Drop the Bun container entirely. Go Workers-native.
- PDF/QR generation is expendable.
- 1GB request bodies irrelevant — uploads already go browser → bucket.
- No Hyperdrive. Overkill at this size.
- No intermediate "Postgres on Workers" milestone. Straight to D1.
- Rename `vps` → `api.goosebumps.fm`.

Three spec errors were caught and corrected before implementation:

1. Claimed 41 transaction sites; actually **24**. The grep had matched
   `.claude/worktrees/` copies. Fixed in `0c76bf8c`.
2. Tag normalization design missed `releases.tags` and all four `genres`
   columns. M3 halted on it. Replaced with the polymorphic
   `labels` / `entity_labels` design in `227ed2e9`.
3. Proposed package name `@gbfm/api` collides with the existing `packages/api`.
   Renamed to `@gbfm/server` in `eeb459a5`.

### M1 — Audit and gate ([OPS-245](https://linear.app/issue/OPS-245))

Evidence: `evidence/d1-m1-gate.md`, `evidence/d1-database-sizing.md`

Production DB measured at **13,604,543 bytes (12.97 MiB)** — 0.136% of D1's
10 GB cap. Sizing was never a risk.

### M2 — Transaction classification ([OPS-246](https://linear.app/issue/OPS-246))

Evidence: `evidence/d1-transaction-classification.md`

D1 has **no interactive transactions**, only `batch()`. Every one of the 24
transaction sites was classified as batchable, restructurable, or requiring a
Durable Object. This constraint recurs throughout the rest of the doc.

### M3 — Schema translation ([OPS-247](https://linear.app/issue/OPS-247))

Evidence: `evidence/d1-m3-report.md`

`pg-core` → `sqlite-core` across 41 tables. Two structural changes:

**Tag normalization** — six array columns (`audio.tags`, `posts.tags`,
`shows.tags`, `releases.tags`, plus four `genres` columns) collapsed into a
polymorphic pair:

```ts
export const labelsTable = sqliteTable('labels', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  kind: text({ enum: ['tag', 'genre'] }).notNull(),
  name: text().notNull(),
}, (t) => [uniqueIndex('labels_kind_name_uq').on(t.kind, t.name)])

export const entityLabelsTable = sqliteTable('entity_labels', {
  entityType: text('entity_type', { enum: [...] }).notNull(),
  entityId: text('entity_id').notNull(),
  labelId: text('label_id').notNull().references(() => labelsTable.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey(...), index('entity_labels_label_idx').on(t.labelId, t.entityType)])
```

**Full-text search** — Postgres `tsvector` → FTS5 standalone table with the
**trigram** tokenizer (chosen over `porter unicode61` for substring matching):

```sql
CREATE VIRTUAL TABLE posts_fts USING fts5(
  title, description, content, tags, tokenize='trigram');
```

Not external-content — the sync triggers are explicit. See
`evidence/d1-search-fixture.md`.

### M4 — Workers port ([OPS-248](https://linear.app/issue/OPS-248))

The largest milestone. `apps/vps` → `apps/server`, and the Bun runtime removed.

**Composition seam.** `apps/server/src/worker.ts` now owns `fetch`, `scheduled`
and `queue`, building `AppLayer` per-request from `ApiEnv` bindings. Previously
`AppRuntime` was a module-level `ManagedRuntime` singleton — which does not work
on Workers, since bindings only exist inside a request.

**Database as an Effect dependency.** The user's own observation drove this:

> "all of this passing in of `db` as an explicit dependency in operations all over
> the place feels very unscalable? shouldn't these be Effect operations that just
> allow me to yield the db when I need it instead?"

Folded into M4. `Database` became a `Context.Service` carried in the R channel;
five commits (`09bb18a9`, `659ee7ae`, `05620a92`, `68af731c`, `ecd274d6`)
threaded it through show/release/audio, bluesky/search, music-entity, and
user/favorite services.

**Bun-native features and their replacements:**

| Removed | Replacement |
| --- | --- |
| `FOR UPDATE` navigation lock | Durable Object `NavigationLock` (`036d988b`) |
| In-process rate limiter | Cloudflare rate-limiting rule ([OPS-256](https://linear.app/issue/OPS-256), unbuilt) |
| Bluesky sync SSE route | Polled status endpoint (`683cbc80`) |
| `@sentry/bun` module-scope `init()` | `@sentry/cloudflare` `withSentry` wrapper (`905e0480`) |
| Reminder polling loop | Cloudflare Queue + idempotent claim (`63fdbb1f`) |
| Sitemap in-memory cache | KV-backed `SitemapCache` (`4421c7c0`) |

**Bundle size.** `evidence/d1-bundle-size.md`. Early measurement said 3.73 MiB
against the 3 MiB limit — but that measured the *Bun* graph, including packages
M3/M4 delete. The ported graph is **2.56 MiB gzipped**, and the actually-deployed
staging bundle came in at **1.91 MiB**. Corrected in `6c8dc959`.

### M5 — Data migration and staging rehearsal ([OPS-249](https://linear.app/issue/OPS-249))

Evidence: `evidence/d1-migration-verification.md`, `evidence/d1-staging-rehearsal.md`,
`evidence/d1-cutover-readiness.md`

Tooling: `apps/server/scripts/migrate-pg-to-d1.ts` and `verify-pg-to-d1.ts`.

Rehearsed against a real production snapshot. **All 41 tables matched on row
counts and checksums; `pragma foreign_key_check` returned 0 violations.**
Rehearsal ran in 35.9s — but that is a local number, not a cutover-window
estimate.

Staging worker deployed and verified:

- `GET /health/live` → 200 `{"ok":true}`
- `GET /health/ready` → 200 `{"dbConnected":true}`
- Durable Object: two concurrent same-cookie navigation requests → `200,200`,
  positions `1/2` and `2/3`
- Cron `* * * * *` registered, sitemap regeneration executing
- Queue consumer registered, batch 10, retries 3, wait 5000ms
- `@sentry/cloudflare` booted without a Node import crash (DSN transport unverified,
  staging has no DSN binding)

---

## Bugs found and fixed

These are the substantive ones. Each was verified independently, not taken on an
agent's word.

**53-row data-loss near-miss.** The M1 audit recommended keying
`music_entity_links` uniqueness on `(entity_type, platform, url)`. Applying that
to production data would have dropped **53 real rows**. Corrected in `840db8f6`:

```ts
- uniqueIndex('music_entity_links_identity_uq').on(table.entityType, table.platform, table.url)
+ uniqueIndex('music_entity_links_identity_uq').on(table.entityType, table.entityId, table.platform)
```

**Error 1102 (CPU limit exceeded) on boot.** `@mdx-js/mdx` was being evaluated at
module scope, blowing the Worker startup CPU budget — 8 of 10 health checks
failing. An agent had misattributed this to Time Travel. Three-line fix
(`754779ae`), verified 30/30 clean afterwards:

```ts
- import { compile } from '@mdx-js/mdx'
- compile(content, { outputFormat: 'function-body' }).then(...)
+ import('@mdx-js/mdx').then(({ compile }) =>
+   compile(content, { outputFormat: 'function-body' }).then((result) => result.toString()))
```

**Systemic 2-hour timestamp offset.** node-postgres parsed
`timestamp without time zone` in the local OS timezone. Every migrated timestamp
was wrong by the machine's UTC offset. Fixed with explicit pg type parsers
(`52a0a1c1`).

**30–40% concurrent write failure on favorites** ([OPS-258](https://linear.app/issue/OPS-258)).
`favorite.service.ts` did check-then-insert; under D1's serialized writes the
collisions became unhandled defects via `dieOnDatabaseError`. Fixed `36ac95cc`.

**66 unit tests silently skipped since M3** ([OPS-254](https://linear.app/issue/OPS-254)).
M3 had changed the `"test"` script to run only `vitest.d1.config.ts`. The suite
was green because most of it wasn't running.

**`Context.Service` returning `undefined`.** In Effect 4.0.0-beta.99 the
non-curried `Context.Service<T>('Name')` form returns `undefined` at runtime →
`Cannot read properties of undefined (reading 'key')` → 144 test failures. Fixed
in `navigation-lock.ts` and `sitemap-cache.ts` by using the curried class form.

**`timeQuery` resolving Database through the module singleton** (`e334d2f0`).
`ManagedRuntime` builds all merged layers eagerly, so the poisoned `Database`
layer killed 13 unrelated call sites:

```ts
+ import { AppLoggerLive } from '@/services/logger.service'
- const exit = await AppRuntime.runPromiseExit(program)
+ const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(AppLoggerLive)))
```

**Spotify import race** ([OPS-259](https://linear.app/issue/OPS-259)) — see below.

---

## Open: the Spotify duplicate question

`evidence/ops-259-spotify-import-identity-audit.md`

`resolveSpotifyTrack` / `resolveSpotifyPlaylist` generated a fresh
`crypto.randomUUID()` and then relied on `onConflictDoNothing` against an index
keyed on *that same fresh UUID* — a guard that could never fire. Concurrent
imports of the same Spotify URL produced duplicate entities.

Production audit (read-only): **51 shared-URL groups / 104 entities globally;
8 groups / 16 entities scoped to Spotify tracks; 0 playlists.** All groups had
identical titles within the group and distinct generated-suffix slugs — historical
duplicates, not legitimate polysemy.

**Shipped fix** (`e2e4682b`): a Durable Object keyed on entity type + Spotify URL
serializes resolve-and-create. Preserves every existing row, prevents new
duplicates, doesn't redefine link identity. Two 20-way concurrent resolver tests
assert exactly one link and entity with `Cause.hasDies(...) === false`.

**Not shipped:** the partial unique index. It cannot apply with zero row loss
while the 8 duplicate groups exist.

**Deferred dedupe.** The duplicates are duplicate *entities*, not just duplicate
links — so reconciling them is a merge, not a delete. Every table referencing a
track id must be repointed:

| Table | Key | Cascade? |
| --- | --- | --- |
| `music_track_artists` | PK `(trackId, artistId)` | yes |
| `music_playlist_tracks` | PK `(playlistId, trackId)` | yes |
| `music_entity_links` | `(entityType, entityId)` | yes |
| `entity_labels` | PK `(entityType, entityId, labelId)` | yes |
| `posts` | `musicEntityType` / `musicEntityId` | **no FK — manual repoint** |
| favorites, reminders | — | unverified |

Composite-PK collisions are the real risk: if duplicates A and B share a playlist,
artist or label, `UPDATE ... SET id = winner` violates the PK. Each join table
needs insert-or-ignore-then-delete. D1's lack of interactive transactions makes
multi-table atomicity harder. Slugs also need redirects, not deletes — both
entities have live URLs.

**Recommended sequence:** cutover → dedupe (new issue) → add the partial unique
index → optionally drop the DO. The table list above is verified from schema
files; the **collision counts within those 8 groups are not** and should be the
first thing the dedupe issue establishes.

---

## Cutover gate

`evidence/d1-cutover-readiness.md`. Verdict from the staging rehearsal:
**not ready.** Open items:

1. **Public body parity** — all 14 public endpoints return 200 on both stacks,
   but only **6 of 14 bodies match exactly**. 8 have remaining mismatches.
2. **Session continuity** — Better Auth moved `drizzleAdapter` from
   `provider: 'pg'` to `'sqlite'`. Live sessions surviving cutover is untested.
3. **Safe reminder delivery** — queue-based reminders must not double-send or
   drop across the switch.
4. **Write-load testing** — D1 serializes writes. No load test has been run.
5. **Time Travel restore drill** — the rollback path is unexercised.

[OPS-256](https://linear.app/issue/OPS-256) (rate-limiting rule) is also open, but
the user has taken it.

---

## Repository state

- Branch `prod`, **~50 commits ahead of `origin/prod`, unpushed.**
- D1 and R2 work is **interleaved** in that history. A second agent did the
  S3 → R2 migration concurrently (`evidence/r2-mixes-copy-2026-08-09.md`,
  `evidence/r2-router-smoke-2026-08-08.md`). Decide whether to separate before
  pushing.
- **5 known typecheck errors** remain, all in Alchemy stack types
  ([OPS-253](https://linear.app/issue/OPS-253)). `bun precommit` passes format
  and lint, then stops on these.
- Test counts at last run: **412 unit passed, 18 D1 passed.**

### Infrastructure

`alchemy.run.ts` at repo root:

```ts
export default Alchemy.Stack('gbfm',
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack
    const isProduction = stack.stage === 'prod'
    const db = yield* Cloudflare.D1.Database('Database', { migrationsDir: './apps/server/drizzle-d1' })
    // R2 x2, KV Sitemap, Queues.Queue Reminders, DurableObject NavigationLock + SpotifyImportResolver
    const api = yield* Cloudflare.Worker('Api', {
      main: './apps/server/src/worker.ts',
      ...(isProduction ? { domain: 'api.goosebumps.fm' } : { url: true }),
      compatibility: { date: '2026-08-09', flags: ['nodejs_compat'] },
      crons: ['* * * * *'], env: { DB, USER_CONTENT, MIXES, SITEMAP, REMINDERS }
    })
  }))
```

SST still owns DNS, ECS and S3. Retiring it is [OPS-255](https://linear.app/issue/OPS-255),
sequenced after cutover.

**Staging teardown** — not run automatically:

```sh
bunx alchemy destroy --stage d1-staging --yes
```

---

## Constraints observed throughout

- Production DB access was **read-only**. No production writes were performed.
- No DNS change, no cutover, no staging teardown.
- The concurrent S3 → R2 agent's changes were left untouched.
- Cutover waits for human review, per standing instruction.

---

## Where to pick up

1. Review the ~50 unpushed commits. Decide on D1/R2 separation.
2. Close the 5 typecheck errors ([OPS-253](https://linear.app/issue/OPS-253)) so
   `bun precommit` goes fully green.
3. Work the cutover gate: body parity on the 8 mismatched endpoints first — it's
   the largest unknown.
4. Build the rate-limiting rule ([OPS-256](https://linear.app/issue/OPS-256)).
5. Cutover ([OPS-250](https://linear.app/issue/OPS-250)).
6. Then: Spotify dedupe + unique index, and full Alchemy
   ([OPS-255](https://linear.app/issue/OPS-255)).
