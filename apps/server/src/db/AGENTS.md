# Schemas and migrations

This is about defining tables and shipping them. For writing queries against
them, read `docs/agents/drizzle-queries.md` instead.

## The client

`layer.ts` builds `drizzle-orm/d1` over the Worker's `env.DB` binding and
exposes it as the Effect `Database` service. `worker.ts` composes
`DatabaseLayer(env.DB)` per invocation. That is the only client: the API runs as
a Cloudflare Worker on D1, and the Bun/Postgres runtime has been retired.

Every schema file uses `sqliteTable` from `drizzle-orm/sqlite-core`. There is no
`pgTable` in this directory. If you are reaching for Postgres types, you are in
the wrong dialect.

## One migration directory

`apps/server/drizzle-d1/` (sqlite) is what ships. `alchemy/storage.ts` passes
`migrationsDir: './apps/server/drizzle-d1'` to the D1 database resource for
every non-local-dev stage.

The former `apps/server/drizzle/` Postgres chain was deleted along with the Bun
runtime. It remains in git history if you ever need it (last touched in
`bcd42b00e`).

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
`_journal.json` entry, no snapshot.

So `drizzle-kit generate` does not work here. Run it and drizzle diffs your
current schema against the 0000 snapshot and tries to re-create everything added
since, prompting on every column:

```
npx drizzle-kit generate --config drizzle.d1.config.ts
# Error: Interactive prompts require a TTY terminal
#   at promptColumnsConflicts ...
```

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
3. Add an entry to `meta/_journal.json`: next `idx`, `"version": "7"`, a `when`
   timestamp, `tag` matching the filename without `.sql`.
4. Add the filename to `d1MigrationFiles` in `src/test/migrate-d1.ts`. That
   array is the literal replay list for tests. Omit it and your tests run
   against a database that does not have your column.
5. `cd apps/server && bun run test`.

## Adding a table

Same five steps, plus:

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
