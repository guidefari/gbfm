# PlanetScale Postgres to Cloudflare D1

## Summary

Move `apps/vps` off PlanetScale Postgres and the Bun/ECS runtime onto Cloudflare
Workers with D1, provisioned by Alchemy V2. No Cloudflare Container step.

The load-bearing change is not the SQL dialect. It is that **`db` is currently a
module-level singleton** (`apps/vps/src/db/index.ts` constructs a `pg.Pool` at
import time) and Workers have no database handle at module scope. Every service
imports that binding directly. Replacing it with a request-scoped Effect Layer is
the work; the `pg-core` to `sqlite-core` translation rides along.

Supersedes "Phase 4: optional D1 migration" in
[`cloudflare-backend.md`](cloudflare-backend.md) and revises that document's
Container-first compute decision.

## Context / Current State

### Runtime

`apps/vps` runs Bun on ECS behind API Gateway. It serves an Effect `HttpApi`,
owns Better Auth, and runs two in-process loops.

Non-test `node:*` usage is thinner than the parent document assumed:

- `node:crypto` (11 sites) — available under `nodejs_compat`;
- `node:fs` / `node:path` / `node:url` — **only** `qrcode.service.ts`, being deleted;
- `node:http` — test-only (`s3.service.test.ts` stubs S3 with a local server).

`@effect/platform-bun` is exactly two imports, both in `http/routes.ts`
(`BunFileSystem`, `BunPath`), both serving the QR/PDF font path. Deleting that
feature removes the dependency.

Installed: `effect@4.0.0-beta.99`, `@effect/platform@0.96.2`,
`drizzle-orm@0.45.2`, `better-auth@1.6.18`. Local tagged-error convention is
`Data.TaggedError` (`apps/vps/src/errors.ts`), not `Schema.TaggedErrorClass`.

### Persistence

41 tables across 14 schema files. Better Auth uses
`drizzleAdapter(db, { provider: 'pg' })` in `lib/auth.ts`.

| Feature | Count | Notable locations |
| --- | --- | --- |
| `uuid()` | 105 | all schema files |
| `timestamp()` | 84 | all schema files |
| `index()` | 66 | all schema files |
| `varchar()` | 54 | all schema files |
| `.array()` | 7 | `music-entity.schema.ts` (6), `util.ts` (1) |
| `pgEnum()` | 14 | `audio`, `external-account`, `music-reminder`, `post`, `upload-asset` |
| `jsonb()` | 11 | `email`, `external-account`, `music-entity`, `release` |
| GIN index | 2 | `audio.schema.ts:42`, `post.schema.ts:50` |
| Partial index | 2 | `navigation.schema.ts:20,23` |
| `db.transaction()` | 24 | services, widely (18 batchable, 5 guarded, 1 serialized) |

### Process-local state

| Thing | File | Why it cannot survive |
| --- | --- | --- |
| Reminder loop | `app.ts:11-42` | `Schedule.forever` racing an in-process signal |
| Sitemap regeneration | `app.ts:44-65` | Hourly loop, result held in module memory |
| `InMemoryRateLimiter` | `middlewares/rate-limiter.ts` | `Map` + `setInterval`, one global instance |
| Bluesky SSE | `http/bluesky-events.routes.ts:106` | Holds a connection, re-polls a join every 1s |
| Graceful shutdown | `app.ts:70+` | No process lifecycle in Workers |

## Goals

- Retire PlanetScale Postgres and the ECS/Bun runtime.
- Preserve the public API contract. `apps/www` and mobile see no change except
  the one noted in Non-Goals.
- Provision with Alchemy V2, matching `~/source/oss/videoshare`.
- Build the new stack alongside the old one and flip by DNS, keeping the ECS
  stack as the rollback target rather than building intermediate infrastructure.
- Retire the `vps` name along with the machine it described.

## Non-Goals

- R2 storage migration. Owned by [`s3-to-r2.md`](s3-to-r2.md); lands first.
- Email provider migration. `resend` is already a dependency.
- PDF/QR generation. Deleted, not ported.
- Preserving the Bluesky SSE transport. It becomes a polled endpoint, which is
  the one frontend-visible change in this spec.

## Invariants

- Endpoints returning `tags: string[]` keep returning `tags: string[]`, whatever
  the storage shape.
- UUID primary keys keep their exact textual values across the migration, so
  foreign keys and any persisted external references survive.
- Timestamps remain UTC-equivalent and preserve ordering and range semantics.
- Better Auth sessions issued before cutover remain valid after it.
- No Cloudflare binding type appears in a Service Module or Domain Module
  signature (`CLOUDFLARE_ARCHITECTURE.md`).
- Expected failures stay in Effect's typed error channel using
  `Data.TaggedError`.

## Design Constraints

- **D1 has no interactive transactions.** Only `batch()`: an ordered atomic
  statement array with no mid-batch reads.
- **Workers have no module-scope database handle.** The binding lives on
  per-request `env`.
- **D1 caps at 10 GB per database** and serializes writes. You have stated the
  database is comfortably small; two confirming measurements are taken in
  Milestone 1 rather than gated on.
- SQLite has no `ILIKE`, no `unnest`, no array type, no GIN, no
  `gen_random_uuid()`, and sorts NULLs first on `DESC`.
- Alchemy V2 is the established form here: `Alchemy.Stack` with `Effect.gen`,
  namespaced imports (`alchemy/Cloudflare`). Not the V1 `alchemy.run.ts` style.

## Alternatives Considered

### Option 1: Container first, Postgres retained

The parent document's plan. Lift the Bun image into a Cloudflare Container,
migrate data later.

Rejected. Its three justifying constraints are gone: uploads already go
browser-to-bucket by presigned URL, PDF/QR is being dropped, and the reminder
loop must move to Cron Triggers regardless. What remains is a fixed-pool,
sleep/wake compute model with random routing, which is worse than ECS.

### Option 2: D1 accessed from a Container over the REST API

Rejected. One HTTPS round trip per statement and no interactive transactions,
against 24 transaction sites. Strictly worse than the Postgres it replaces, and
the work is discarded at the eventual Workers port.

### Option 3: Workers on Hyperdrive first, D1 second

Port the runtime to Workers while still reading PlanetScale through Hyperdrive,
then swap the data layer as a separate deploy. Buys the property that runtime
bugs and data bugs cannot arrive together.

Rejected as overkill for a project this size. Hyperdrive is a whole piece of
infrastructure provisioned, configured, and deleted within two milestones, to
serve a rollback story for a solo-maintained application whose database is small
enough to re-import in minutes. The rollback that actually matters here is
"redeploy the ECS service and repoint DNS," which stays available regardless.

### Option 4 (recommended): Workers + D1 in one cutover

Build the Worker directly against D1. Migrate the data, run both stacks in
parallel on separate hostnames until the new one passes, then repoint DNS.

No Hyperdrive, no intermediate Postgres-on-Workers step. The old ECS stack stays
untouched and serving until the flip, which is a better rollback target than a
half-migrated Worker anyway.

## Recommendation

Option 4.

## Proposed Design

### The composition seam

This is the core of the spec. `videoshare` is the working precedent:

```ts
// apps/api/src/worker.ts — the ONLY place env is visible
export default {
  async fetch(request: Request, env: ApiEnv, ctx: ExecutionContext) {
    return handler(request, requestScope(env, ctx))
  },
  async scheduled(controller: ScheduledController, env: ApiEnv) {
    return runCron(controller.cron, requestScope(env))
  },
  async queue(batch: MessageBatch<ReminderJob>, env: ApiEnv) {
    return runReminders(batch, requestScope(env))
  },
}
```

`ApiEnv` is declared once, at the seam, and never travels inward:

```ts
type ApiEnv = {
  readonly DB: D1Database
  readonly USER_CONTENT: R2Bucket
  readonly MIXES: R2Bucket
  readonly SITEMAP: KVNamespace
  readonly REMINDERS: Queue<ReminderJob>
  readonly BETTER_AUTH_SECRET: string
}
```

Services keep receiving capabilities named in domain terms, never bindings:

```ts
// Good — service-facing
interface SitemapCache {
  readonly read: () => Effect.Effect<Option<SitemapXml>, never>
  readonly write: (xml: SitemapXml) => Effect.Effect<void, SitemapCacheError>
}

// Rejected — leaks the binding
interface SitemapCache { readonly kv: KVNamespace }
```

### Database access

Replace the module-level `db` export with a Layer built per request:

```ts
// apps/api/src/db/layer.ts
export class Database extends Context.Tag('Database')<
  Database,
  DrizzleD1Database<typeof schema>
>() {}

export const layer = (db: D1Database) =>
  Layer.succeed(Database, drizzle(db, { schema }))
```

Every consumer changes from `import { db } from '@/db'` to `yield* Database`.
This is mechanical, touches every service, and is the reason Milestone 2 ships
alone on Postgres.

### ORM choice: Drizzle, not `@effect/sql-d1`

Worth stating explicitly, because the two available precedents disagree.

`~/source/oss/videoshare` — the only other D1 project here — uses **no ORM**. It
depends on `@effect/sql-d1`, composes queries as tagged-template SQL through
`SqlClient`, declares row DTOs by hand (`ProjectRow`, `AssetRow`, `ChapterRow`),
and converts rows to domain values in explicit projection functions
(`toProject`, `toAsset`) that wrap failures as `PersistenceError`.

`CLOUDFLARE_ARCHITECTURE.md` says the opposite:

> Use Drizzle for application-owned Cloudflare SQL storage: schema modules;
> inferred select/insert/update DTOs; Drizzle migrations; queries through
> Drizzle; parser/projection functions at the External Adapter Module seam.
>
> Raw SQL is reserved for tiny bootstrapping glue, framework internals, generated
> migrations, or cases Drizzle cannot express cleanly.

This spec follows the standard, for reasons specific to this repo rather than
deference:

- 41 tables against videoshare's handful. Hand-written row DTOs and projections
  are cheap at that size and a large ongoing surface at this one.
- Every query, relation, and migration in `apps/vps` already runs through
  Drizzle. Rewriting them to raw SQL is work that buys nothing.
- `docs/agents/drizzle-queries.md` is an established repo convention with a
  generated-SQL test strategy behind it.
- Better Auth's adapter takes a Drizzle instance directly.

Keep the parts of videoshare's shape that are good regardless of ORM: explicit
row-to-domain projection at the adapter seam, `PersistenceError` in the typed
error channel, and services that depend on a capability rather than a client.

## Domain Model and Types

### Tags: array column to join table

Array columns become rows. This removes the two GIN indexes and every `unnest()`
call site at once.

There are **nine** array columns across eight tables, not the three an earlier
draft of this spec named. `tags` is not a per-table column: it lives in
`defaultContentFields` (`db/util.ts:20`) and arrives by spread, so every content
table has one.

| Table | Columns | Origin |
| --- | --- | --- |
| `audio`, `shows`, `releases`, `posts` | `tags` | `defaultContentFields` spread |
| `music_artists` | `genres` | own |
| `music_albums` | `genres`, `artistNames` | own |
| `music_tracks` | `artistNames` | own |
| `music_labels` | `tags`, `genres` | own |

Per-table join tables would mean six of them, and a seventh the next time a table
spreads `defaultContentFields`. Since the source column is shared, the join table
is shared too:

```ts
export const labelsTable = sqliteTable(
  'labels',
  {
    id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
    kind: text({ enum: ['tag', 'genre'] }).notNull(),
    name: text().notNull(),
  },
  (t) => [uniqueIndex('labels_kind_name_uq').on(t.kind, t.name)],
)

export const entityLabelsTable = sqliteTable(
  'entity_labels',
  {
    entityType: text('entity_type', {
      enum: ['audio', 'show', 'post', 'release', 'artist', 'album', 'track', 'musicLabel'],
    }).notNull(),
    entityId: text('entity_id').notNull(),
    labelId: text('label_id').notNull().references(() => labelsTable.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.entityType, t.entityId, t.labelId] }),
    index('entity_labels_label_idx').on(t.labelId, t.entityType),
  ],
)
```

`entity_type` follows the existing discriminator convention already used by
`posts.music_entity_type`, so this is not a new pattern in the schema.

Two consequences, both deliberate:

- **No foreign key on `entity_id`.** A polymorphic link table cannot declare one.
  Deletes must clear `entity_labels` explicitly, which adds a statement to the
  category A batch at each delete site rather than relying on `ON DELETE CASCADE`.
  That is the real cost of the shared design. The alternative is six
  near-identical tables plus a standing rule nobody remembers on table seven.
- **`kind` keeps tags and genres in one table.** Same shape, never mixed in a
  query, separated by a predicate. Splitting them would duplicate a schema to
  encode a value.

The API keeps returning `tags: string[]` and `genres: string[]` exactly as today;
the projection aggregates by `kind` at the adapter seam.

`artistNames` is excluded, and stays a denormalized column stored as JSON text.

Earlier drafts of this spec called it "a third representation" of a relationship
`music_track_artists` / `music_album_artists` already model, and left the choice
open. Reading the call sites settles it: **it is not a cache, and deriving it
would lose data.**

- **Order is information the join table does not carry.**
  `playlist-tracks.service.ts:481,665` builds slugs from
  `t.artistNames.join(' ')`, and `TweetMusicEntityCard.tsx:186` renders
  `artistNames.join(', ')`. `music_track_artists` has no ordering column, so a
  derived array would come back in arbitrary order and silently change existing
  slugs.
- **It is a credit snapshot, not a projection.** It records the names as credited
  on that release. An artist later renaming themselves should not retroactively
  rewrite historical credits.
- **Write consistency is already handled.** `scrape.service.ts:117-120` derives
  `artistNames` and `artistIds` from one `findOrCreateArtistsByName` call and
  writes both together. There is one writer, not a drift-prone many.

So the two structures record different facts: the join table is the entity link,
the column is the credit line. Twelve call sites consume the column as a plain
array; deriving it would add a join to every read to remove a risk that does not
exist.

```ts
artistNames: text({ mode: 'json' }).$type<string[]>()
```

This differs from the `tags` treatment above deliberately. Tags are normalized
because they are queried (`unnest` + `ILIKE`, two GIN indexes) and unordered.
`artistNames` is never queried as a set, only displayed in order.

### Type translation

| Postgres | SQLite | Rationale |
| --- | --- | --- |
| `uuid().defaultRandom()` | `text().$defaultFn(() => crypto.randomUUID())` | No `gen_random_uuid()`. Text preserves values byte-for-byte, so FKs survive import. |
| `timestamp({ withTimezone: true })` | `integer({ mode: 'timestamp_ms' })` | Values are already UTC on the wire; the annotation carries no data. |
| `.defaultNow()` | `$defaultFn(() => new Date())` | Application-side. |
| `pgEnum(...)` | `text({ enum: [...] })` | Drizzle keeps the TS union. Matches the repo preference for objects over enums. |
| `varchar({ length: n })` | `text()` | SQLite ignores length. Add `CHECK` only where the limit is a domain rule. |
| `jsonb()` | `text({ mode: 'json' }).$type<T>()` | All 11 sites read/write whole values; no JSON-path queries. |
| `boolean()` | `integer({ mode: 'boolean' })` | Stored 0/1. |
| `.array()` | join table | Above. |
| GIN index | FTS5 | Below. |
| Partial unique index | Partial unique index | SQLite supports these; verify Drizzle emits `WHERE`. |

### Search: ILIKE to FTS5

```sql
CREATE VIRTUAL TABLE posts_fts USING fts5(
  title, description, content, tags,
  tokenize='trigram'
);
```

Note this is a **standalone** FTS5 table, not `content='posts'` external-content.
Once tags move to `entity_labels`, the indexed `tags` column is an aggregate of
rows in another table, so there is no single source row to point at. Triggers
populate all four columns: on `posts` for the text fields, and on `entity_labels`
for the tag string. External-content mode would only work if every indexed column
lived on `posts`.

Triggers keep it current on insert/update/delete. `shows` and `audio` get the
same treatment.

### Tokenizer: trigram, not the default

The default FTS5 tokenizer matches token *prefixes*. Today's `ILIKE '%term%'`
matches anywhere in the string. That difference is user-visible, and the UI
decides it: `GlobalSearchDialog.tsx` is a command palette that queries from the
first character (`query.trim().length > 0`), with no debounce and no minimum
length.

Under the default tokenizer, typing `goo` returns nothing until a whole word is
completed, because `goo` only matches tokens beginning with "goo". Every query
would look broken for its first few keystrokes. Trigram keeps the current
substring semantics, so the M1 search fixture stays the pass criterion rather
than something renegotiated mid-migration.

Costs, both acceptable here: the trigram index is larger (the dataset is small),
and trigram requires at least 3 characters to match. Queries of 1-2 characters
fall back to `LIKE`, which is cheap at this size.

Revisit only if relevance ranking becomes a product requirement. Trigram does not
rank as well as the default tokenizer, which matters for large corpora and does
not matter for a palette that returns a handful of rows per group.

`search.service.ts` collapses from three near-identical `ILIKE`-or-`unnest`
branches to three `MATCH` queries. The 60-line `matchCondition` at
`post.service.ts:747` becomes an FTS5 query joined against the music entity
tables, losing its `ILIKE` and `::text` casts.

Note `post.service.ts:740-745`: several real column names are quoted camelCase
(`"albumId"`, `"artistNames"`) because those tables were defined without explicit
db-name strings. Every hand-written SQL string referencing them must be
re-audited during translation.

## Types, Interfaces, and APIs

### New

```ts
// db/layer.ts
class Database extends Context.Tag('Database')<Database, DrizzleD1Database<typeof schema>>() {}
const layer: (db: D1Database) => Layer.Layer<Database>

// worker.ts
type ApiEnv = { /* as above */ }
const requestScope: (env: ApiEnv, ctx?: ExecutionContext) => Layer.Layer<AppServices>

// services/sitemap-cache.ts
interface SitemapCache {
  readonly read: () => Effect.Effect<Option<SitemapXml>, never>
  readonly write: (xml: SitemapXml) => Effect.Effect<void, SitemapCacheError>
}

// services/reminder-queue.ts
interface ReminderQueue {
  readonly enqueue: (job: ReminderJob) => Effect.Effect<void, ReminderQueueUnavailable>
}

type ReminderJob = {
  readonly reminderId: ReminderId
  readonly idempotencyKey: string
  readonly dueAt: number
}
```

New errors follow the local `Data.TaggedError` convention:

```ts
export class SitemapCacheError extends Data.TaggedError('SitemapCacheError')<{
  readonly message: string
}> {}

export class ReminderQueueUnavailable extends Data.TaggedError('ReminderQueueUnavailable')<{
  readonly reminderId: string
}> {}
```

### Changed

- Every service constructor/effect that read the `db` import now requires
  `Database`.
- `drizzleAdapter(db, { provider: 'pg' })` becomes `provider: 'sqlite'` with the
  request-scoped client.
- Bluesky sync progress: `GET /bluesky/events/:runId` (SSE) becomes
  `GET /bluesky/runs/:runId/status` returning the existing `toEvent` payload as
  JSON.

### Deleted

- `middlewares/rate-limiter.ts` and its middleware. Replaced by a Cloudflare Rate
  Limiting rule. It is a 60 req/min per `path:ip` abuse guard with no billing or
  correctness dependency; porting the counter into a DO or KV would add a
  per-request hop to protect a number whose accuracy does not matter.
  Two accepted changes: the `x-ratelimit-*` response headers disappear (grep
  consumers first), and limiting becomes per-colo so a distributed client sees a
  higher effective ceiling.
- `services/qrcode.service.ts`, its routes, `pdf-lib`, `@pdf-lib/fontkit`,
  `qrcode`, and the two `BunFileSystem`/`BunPath` imports.
- Graceful shutdown and signal handling in `app.ts`.

## Seams, Boundaries, Adapters, and Implementations

| Seam | Owns | May not know |
| --- | --- | --- |
| `worker.ts` | `ApiEnv`, `ExecutionContext`, Layer construction | domain rules |
| `db/layer.ts` | `D1Database` to Drizzle client | domain rules |
| `services/*` | domain behavior, requires `Database` | binding types |
| `sitemap-cache.ts` | KV read/write, `SitemapXml` in/out | that KV exists, beyond this file |
| `reminder-queue.ts` | Queue send, `ReminderJob` DTO | reminder domain rules |

`ReminderJob` crossing into the queue is a **runtime hop**: a serialization
boundary. It carries `traceId` and `idempotencyKey` explicitly and never carries
`env`, a request, or a database handle.

## Call Stacks and Data Flow

### Current flow

```txt
Bun.serve
  -> Effect HttpApi router
  -> service effect
  -> import { db }            // module-level pg.Pool
  -> db.transaction(...)      // interactive
  -> Postgres over TLS
```

### Proposed flow

```txt
worker.fetch(request, env, ctx)
  -> requestScope(env, ctx)              // the only place env is seen
  -> Layer.provide(Database, drizzle(env.DB, { schema }))
  -> Effect HttpApi router
  -> service effect requires Database
  -> yield* Database
  -> db.batch([...]) | guarded single write
  -> D1 binding (same-isolate)
  -> row DTO -> parser -> domain value -> projection -> JSON
```

### Reminder flow

```txt
Cron Trigger (1 min)
  -> worker.scheduled
  -> query due reminders (bounded LIMIT)
  -> ReminderQueue.enqueue(job)          // runtime hop, DTO only
  -> worker.queue(batch, env)
  -> claim by idempotencyKey (guarded UPDATE ... WHERE status = 'pending')
  -> rows affected === 0 ? already claimed, ack
  -> send, mark sent
```

The guarded claim replaces the in-process signal race in `app.ts`. Overlap
prevention becomes a database predicate rather than a single-process assumption.

### Failure flow

D1 errors surface as `DatabaseError` exactly as today. A failed `batch()` is
atomic: no partial write. A failed guarded write returns zero rows affected,
which the caller treats as a lost race and retries or acks, never as an error.

## Transaction classification

D1 `batch()` is an ordered atomic array with no mid-batch reads. The 24
`db.transaction()` sites split three ways. The M1 audit classified every one;
`docs/migrations/evidence/d1-transaction-classification.md` is the authority,
with per-site guard designs:

1. **Pure write sequences** — insert parent, insert children, bump counter.
   Translate directly to `batch()`. Expected majority.
2. **Read-then-write** — select, decide, write. Restructure so the read happens
   outside the batch and the write carries its own guard
   (`WHERE version = ?`, or an upsert). Retry on zero rows affected.
3. **Genuinely serialized** — `navigation.service.ts:413` holds a lock and is the
   clearest candidate. If a site truly needs mutual exclusion, that moves to a
   Durable Object, not D1.

**This classification is a hard gate.** A miscategorized site is silent data
corruption, not a test failure. Review line by line; do not sample.

## Files to Add / Change / Delete

Paths below use the post-rename `apps/api`; the move from `apps/vps` happens as
one commit in M4.

| File | Action | Responsibility |
| --- | --- | --- |
| `alchemy.run.ts` | add | Alchemy V2 stack: D1, R2 x2, KV, Queue, Worker |
| `apps/api/src/worker.ts` | add | composition seam; `fetch`/`scheduled`/`queue` |
| `apps/api/src/db/layer.ts` | add | `Database` tag + Layer from `D1Database` |
| `apps/api/src/db/*.schema.ts` | change | 14 files, `pg-core` to `sqlite-core` |
| `apps/api/src/db/tags.schema.ts` | add | `tags` + three join tables |
| `apps/api/src/db/index.ts` | delete | the module-level `Pool` and `db` export |
| `apps/api/src/services/**` | change | require `Database`; classified transactions |
| `apps/api/src/services/search.service.ts` | change | FTS5 |
| `apps/api/src/services/post.service.ts` | change | FTS5; the `:747` block |
| `apps/api/src/services/sitemap-cache.ts` | add | KV-backed capability |
| `apps/api/src/services/reminder-queue.ts` | add | Queue-backed capability |
| `apps/api/src/lib/auth.ts` | change | `provider: 'sqlite'`, scoped client |
| `apps/api/src/app.ts` | change | delete both loops and shutdown handling |
| `apps/api/src/middlewares/rate-limiter.ts` | delete | Cloudflare rule |
| `apps/api/src/services/qrcode.service.ts` | delete | feature dropped |
| `apps/api/src/http/bluesky-events.routes.ts` | change | SSE to polled JSON |
| `apps/api/src/test/global-setup.ts` | change | Testcontainers Postgres to Miniflare D1 |
| `migrations/` | add | generated SQLite migrations + FTS5 triggers |
| `scripts/migrate-pg-to-d1.ts` | add | export, transform, import, verify |

### Alchemy stack sketch

Matching `~/source/oss/videoshare`:

```ts
export default Alchemy.Stack(
  'gbfm',
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack
    const isProduction = stack.stage === 'prod'

    const db = yield* Cloudflare.D1.Database('Database', {
      migrationsDir: './apps/vps/migrations',
    })
    const reminders = yield* Cloudflare.Queue('Reminders')
    const sitemap = yield* Cloudflare.KV.Namespace('Sitemap')

    const api = yield* Cloudflare.Worker('Api', {
      main: './apps/api/src/worker.ts',
      domain: isProduction ? 'api.goosebumps.fm' : undefined,
      url: !isProduction,
      compatibility: { date: '2026-08-09', flags: ['nodejs_compat'] },
      crons: ['* * * * *'],
      env: { DB: db, REMINDERS: reminders, SITEMAP: sitemap },
    })

    return { apiUrl: api.url, databaseName: db.databaseName }
  }),
)
```

Alchemy owns only new resources; existing SST resources stay untouched until
teardown.

### Rename: `vps` to `api`

The name `vps` described an ECS box. Nothing about the new stack is a VPS, so the
name goes with the migration rather than outliving it.

- **Hostname:** `vps.goosebumps.fm` becomes `api.goosebumps.fm`.
- **Workspace:** `apps/vps` becomes `apps/api`; package `@gbfm/vps` becomes
  `@gbfm/api`.

`@gbfm/vps` currently exports `./schemas` (consumed as `@gbfm/vps/schemas`), so
the rename touches every importer of the DB schema types. Do it as one mechanical
commit inside the cutover milestone, not spread across it.

`vps.goosebumps.fm` must keep resolving after the flip. Clients in the wild
include the mobile app and any cached `apps/www` bundle. Point the old hostname
at the same Worker rather than redirecting: an API redirect breaks non-following
clients and turns every request into two. Retire the old hostname only after
traffic on it reaches zero, as its own change.

The `prod_endpoints` memory recording `vps.goosebumps.fm` as the API host needs
updating when this lands.

## RGR TDD Test Plan

Vertical slices. Each is one failing behavior test, then minimal implementation.

Workers-runtime behavior uses `@cloudflare/vitest-pool-workers`; pure domain
behavior stays in ordinary fast tests.

**M2 — decoupling, still on Postgres:**

1. Red: a service effect run without `Database` provided fails to typecheck /
   fails at runtime. Green: `Database` tag + Layer.
2. Red: existing service tests, re-run with the Layer-provided client, still pass
   unchanged. This is the regression net for a 41-table refactor.

**M3 — schema and query translation, against local D1:**

3. Red: each translated schema round-trips insert/select with correct types,
   especially `timestamp_ms`, `mode: 'boolean'`, and `mode: 'json'`
   (`CiphertextEnvelope` is the sharp case).
4. Red: tag join table returns `tags: string[]` in the same order the API
   contract tests expect.
5. Red: FTS5 search returns the M1 fixture results.
6. Red: each classified transaction site — one test per category, plus one per
   read-then-write site proving the guard rejects a stale write.
7. Red: `DESC NULLS LAST` ordering matches the Postgres output captured in M1 for
   a fixture containing nulls.

**M4 — Worker runtime:**

8. Red: `worker.fetch` returns 200 for `/health` under `vitest-pool-workers`.
9. Red: a Better Auth cookie issued through the Worker round-trips on the real
   hostname, and a session created against Postgres pre-cutover still validates.
10. Red: `scheduled` enqueues exactly one job for one due reminder.
11. Red: two concurrent `queue` invocations for the same `idempotencyKey` produce
    exactly one send. Guards the highest-consequence new behavior.
12. Red: sitemap regeneration writes KV and `GET /sitemap.xml` serves it.
13. Red: polled Bluesky status endpoint returns the same payload shape the SSE
    `toEvent` produced.

**M5 — data migration:**

14. Red: row counts and per-table checksums match after `migrate-pg-to-d1.ts`.
15. Red: a full black-box API suite run against the migrated staging stack matches
    the same suite run against production. This is the cutover gate.

## Milestones

Each is independently deployable and revertible.

**M1 — Audit and fixtures.** No production change. Measure bundle size first, it
is the cheapest way to falsify the whole approach. Classify all 24 transaction
sites into a table with file, line, category. Capture current search results as
the FTS5 fixture. Record database size and peak write rate.
*Gate:* bundle fits; classification complete; fixture exists.

**M2 — Decouple `db` from module scope.** Ships to production on Postgres, no
behavior change. Pure mechanical refactor, alone, because it touches everything.
The last change that ships to the old stack.
*Gate:* `bun precommit` clean; full suite green; no error-rate or latency change.

**M3 — Schema and query translation.** Nothing deployed. `pg-core` to
`sqlite-core`, tag join tables, FTS5, transaction conversion, Better Auth SQLite
adapter. Developed against local D1 through Miniflare; the Testcontainers
Postgres harness is replaced here, which also deletes the Docker requirement from
the test suite.
*Gate:* slices 3-7 green against local D1.

**M4 — Worker runtime and Alchemy stack.** Nothing serving production traffic.
`apps/vps` becomes `apps/api`. Alchemy stack, composition seam, platform-bun
removal, QR/PDF deletion, Cron + Queue, rate-limiter deletion, SSE to polling,
`@sentry/bun` to the Cloudflare SDK. Deploys to a staging hostname against a D1
database seeded from a production snapshot.
*Gate:* slices 8-13 green; RSS, sitemap, share pages, and the upload flow pass on
staging; cold start and p99 within baseline.

**M5 — Data migration and cutover.** Export, transform, import, verify. Then:
freeze writes on the old stack, final delta export, import, verify, repoint DNS
to the Worker, unfreeze.

Rollback is repointing DNS back at the untouched ECS stack, which is still
running and still connected to PlanetScale. That is the entire reason no
intermediate Postgres-on-Workers step is needed: the old stack is a better
rollback target than a half-migrated new one, and it costs nothing to leave
running through the soak.

Writes that land on D1 after the flip are lost by a rollback. Keep the freeze
window short and the decision point early.
*Gate:* slices 14-15 green; counts and checksums match; sessions survive;
write-path load test shows no contention; D1 Time Travel restore drill succeeds.

**M6 — Teardown.** Separate reviewed change after soak. Remove `pg`, `@types/pg`,
`@effect/platform-bun`, `@types/bun`. Migrate remaining SST-owned Cloudflare
resources to Alchemy. Retire `vps.goosebumps.fm` once its traffic reaches zero.
Decommission PlanetScale and the ECS stack only after final backups are retained
independently.

No destructive step shares a deploy with a traffic switch.

## Risks and Open Questions

| Risk | Severity | Mitigation |
| --- | --- | --- |
| A read-then-write transaction miscategorized as batchable | **High.** Silent corruption. | M1 classification reviewed line by line; slice 6 tests the guard. |
| Better Auth SQLite adapter differs on sessions or account linking | **High.** Locks users out. | Slice 9; real OAuth flows on staging before cutover. |
| Effect + MDX + Better Auth exceed the Workers bundle limit | **High.** Invalidates the approach. | Measured first in M1, before any other work. If it fails, the fix is moving MDX compilation out of the request path (precompile at publish time) rather than abandoning the migration; MDX is the largest and most removable contributor. |
| Writes landing on D1 after the flip are lost if the migration is rolled back | **High.** Data loss. | Short freeze window; early decision point; final delta export immediately before the flip. |
| FTS5 tokenization changes user-visible results | Medium | Trigram tokenizer preserves current substring semantics; M1 fixture is the pass criterion. |
| `artistNames` drifts from the join tables | Low | One writer (`scrape.service.ts:117-120`) sets both from one call. Accepted as a credit snapshot, not a cache. |
| D1 write serialization bottlenecks | Medium | Write rate measured M1; load test is an M5 gate. |
| The `@gbfm/vps` to `@gbfm/api` rename breaks importers of `/schemas` | Medium | One mechanical commit inside M4, not spread across it. Typecheck is the net. |
| Polled sync status feels worse than SSE | Low | Admin-initiated progress indicator. DO with hibernated WebSockets is the fallback. |
| Per-colo rate limiting raises the effective ceiling | Low | Generic abuse guard, no correctness dependency. |

Resolved during drafting, recorded so they are not reopened:

- ~~Which `node:http` import remains?~~ Test-only.
- ~~Does Bluesky SSE need a Durable Object?~~ No; polled endpoint.
- ~~Does the rate limiter need a DO or KV?~~ Neither; delete it.
- ~~`@effect/sql-d1` or Drizzle?~~ Drizzle. The standards call for it, 41 tables
  already run on it, and Better Auth's adapter takes a Drizzle instance. The
  `videoshare` precedent uses `@effect/sql-d1` with raw SQL, but at a fraction of
  the table count.
- ~~Is Hyperdrive worth a staging step?~~ No. Overkill at this size; the untouched
  ECS stack is the rollback target.
- ~~`artistNames`: derived or stored?~~ Stored as JSON text. It carries credit
  order, which the join table cannot express. See the tag section.
- ~~FTS5 default tokenizer or trigram?~~ Trigram. The search UI queries from the
  first keystroke, so prefix-only matching would look broken.

Open, each blocking the milestone that needs it:

- **Does anything consume `x-ratelimit-*`?** Grep `apps/www` and mobile in M4.
- **Does `@mdx-js/mdx` bundle acceptably for Workers?** Part of the M1 bundle
  measurement; it is the largest single unknown in that number. If it dominates,
  precompiling MDX at publish time removes it from the Worker entirely.

## References

- Parent plan: [`cloudflare-backend.md`](cloudflare-backend.md)
- Storage migration, lands first: [`s3-to-r2.md`](s3-to-r2.md)
- Config seam: [`config-service-migration.md`](config-service-migration.md)
- Drizzle query rules: `docs/agents/drizzle-queries.md`
- Alchemy V2 precedent: `~/source/oss/videoshare/alchemy.run.ts`,
  `~/source/oss/here_hugo/alchemy.run.ts`
- Worker + Effect + D1 seam precedent:
  `~/source/oss/videoshare/apps/viewer/src/worker.ts`
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/),
  [import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/),
  [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Drizzle SQLite column types](https://orm.drizzle.team/docs/column-types/sqlite)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
