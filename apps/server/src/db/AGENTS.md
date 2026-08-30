# Schemas and migrations

This is about defining tables and shipping them. For writing queries against
them, read `docs/agents/drizzle-queries.md` instead.

## Which client actually serves production

Two clients live in this directory. Only one runs in production.

- `layer.ts` builds `drizzle-orm/d1` over the Worker's `env.DB` binding and
  exposes it as the Effect `Database` service. `worker.ts` composes
  `DatabaseLayer(env.DB)` per invocation. **This is production.** The API runs
  as a Cloudflare Worker on D1.
- `index.ts` builds a `pg.Pool`. Its only remaining consumer is `src/migrate.ts`,
  which carries two `@ts-expect-error` comments saying the Postgres path is
  retained until M4 replaces the Bun runtime. Treat it as legacy.

Every schema file uses `sqliteTable` from `drizzle-orm/sqlite-core`. There is no
`pgTable` in this directory. If you are reaching for Postgres types, you are in
the wrong dialect.

The module-level `ManagedRuntime` in `src/runtime/index.ts` deliberately binds
`Database` to `Effect.die`. Workers have no module-scope binding handle, so
nothing on that path may resolve a live connection. Do not "fix" it.

## Two migration directories

- `apps/server/drizzle-d1/` (sqlite) is what ships. `alchemy/storage.ts` passes
  `migrationsDir: './apps/server/drizzle-d1'` to the D1 database resource for
  every non-local-dev stage. This is the one that matters.
- `apps/server/drizzle/` (postgresql) is the legacy Postgres history. Nothing in
  the deploy path reads it. Its only consumers are `src/migrate.ts`, reachable
  only through the manual `db:migrate:prod` script and marked
  `@ts-expect-error` as retained until M4, and
  `label-music-entity-migration.test.ts`, which needs Docker.

Each directory has its own `meta/_journal.json` with its own independent index,
so the numbering has long since diverged: 55 Postgres migrations against 6 for
d1.

Recent changes have written both, and until the Bun/Postgres runtime is
formally retired that keeps the legacy chain replayable. If you do write the
Postgres twin, **it must be real Postgres**. The two dialects quote
differently:

```sql
-- drizzle-d1/    sqlite
CREATE INDEX `idx_name` ON `table_name` (`column`);
-- drizzle/       postgres
CREATE INDEX "idx_name" ON "table_name" ("column");
```

Copying the sqlite file across unchanged produces a migration Postgres rejects,
and nothing in CI will catch it because nothing replays that chain. If you are
not prepared to write correct Postgres, write the d1 migration only and say so
in the commit. A missing twin is recoverable; a broken one is a trap for
whoever runs the chain next.

## Rules that are not negotiable

- Use `drizzle migrate`, never `drizzle push`. The production ledger was
  baselined after a period of push-built history, so push can silently diverge
  from the recorded state. There is deliberately no push script here; do not add
  one back.
- Never run migrations against production. Verify against a throwaway database.
  The test harness already gives you one: `src/test/migrate-d1.ts` spins up a
  Miniflare D1 and replays the forward migrations.

## The stale snapshot trap

`drizzle-d1/meta/` contains exactly one snapshot, `0000_snapshot.json`.
Migrations 0001 through 0005 were hand-written: SQL file plus a manual
`_journal.json` entry, no snapshot. The Postgres side is the same from 0052 on.

So `drizzle-kit generate` does not work here. Run it and drizzle diffs your
current schema against the 0000 snapshot and tries to re-create everything added
since, prompting on every column:

```
npx drizzle-kit generate --config drizzle.d1.config.ts
# Error: Interactive prompts require a TTY terminal
#   at promptColumnsConflicts ...
```

`bun run gen` at the repo root points at `drizzle.config.prod.ts`, which reads
`config.database.*` and needs env that a plain checkout does not load.

The Postgres chain also carries one orphan: `drizzle/0011_track_mix_plays.sql`
exists on disk with no `_journal.json` entry, so 56 files back 55 entries. It
has been unreferenced since the apps/vps rename. Leave it alone unless you are
deliberately repairing that chain.

Until someone regenerates the snapshot chain, **hand-write migrations**. That is
the working pattern, not a shortcut.

## Column naming

New tables use snake_case in the database and camelCase in TypeScript:

```ts
musicEntityType: text('music_entity_type')
```

This is not uniform. `navigation.schema.ts` and most of `auth.schema.ts` (which
follows better-auth's own names) use camelCase as the literal DB column name:
`userId`, `deviceToken`, `sessionId`. Read the file you are editing before you
pick a name. Match the table you are in, do not "correct" existing columns.

## Adding a column

1. Edit the `*.schema.ts` file. Match the existing naming in that table.
2. Write `apps/server/drizzle-d1/000N_<name>.sql` by hand. Separate statements
   with `--> statement-breakpoint`. This is the one that ships.
3. Optionally write the Postgres twin in `apps/server/drizzle/00NN_<name>.sql`,
   with double-quoted identifiers. Do not copy the sqlite file across.
4. Add an entry to the `meta/_journal.json` beside each file you wrote: next
   `idx`, `"version": "7"`, a `when` timestamp, `tag` matching the filename
   without `.sql`. The two journals number independently.
5. Add the d1 filename to `d1MigrationFiles` in `src/test/migrate-d1.ts`. That
   array is the literal replay list for tests. Omit it and your tests run
   against a database that does not have your column.
6. `cd apps/server && bun run test`.

## Adding a table

Same six steps, plus:

- Add `export * from './your.schema.ts'` to `exports.ts`. That module is the
  schema object passed to `drizzle(database, { schema })` in both `layer.ts` and
  `src/test/d1.ts`. A table missing from it will not exist on `db.query.*`.
- If the table takes part in a relational query, add its shape to
  `relational-queries.smoke.test.ts`. See `docs/agents/drizzle-queries.md` for
  why generated SQL has to be executed rather than snapshotted.

## Tests

- `bun run test:unit` runs `src/**/*.test.ts` excluding `.d1.test.ts`. This
  includes `relational-queries.smoke.test.ts`, which still gets a real Miniflare
  D1 via `src/test/database.ts`.
- `bun run test:d1` runs `src/**/*.d1.test.ts`, including `d1.schema.test.ts`
  (type round-tripping) and the FTS search tests.
- `bun run test` runs both. Run it before you call a schema change done.
