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
  every non-local-dev stage.
- `apps/server/drizzle/` (postgresql) is the legacy Postgres history, still
  numbered in lockstep. Recent pairs are literal translations of each other:
  `0054_navigation_lookup_indexes.sql` and
  `drizzle-d1/0005_navigation_lookup_indexes.sql` differ only in quoting style.

Keep writing both, same content, backticks in the d1 copy. Each directory has
its own `meta/_journal.json` with its own independent index.

## Rules that are not negotiable

- Use `drizzle migrate`, never `drizzle push`. The `db:yeet` script in
  `apps/server/package.json` is `drizzle-kit push`. Do not run it. The
  production ledger was baselined after a period of push-built history, so push
  can silently diverge from the recorded state.
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
   with `--> statement-breakpoint`.
3. Write the Postgres twin in `apps/server/drizzle/00NN_<name>.sql`.
4. Add an entry to both `meta/_journal.json` files: next `idx`, `"version": "7"`,
   a `when` timestamp, `tag` matching the filename without `.sql`.
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
