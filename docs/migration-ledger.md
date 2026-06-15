# Migration ledger baseline (prod)

## The situation

gbfm prod Postgres was originally built entirely with `drizzle-kit push` (the `db:yeet` / `db_pushProd` commands). Push applies schema changes directly and never writes to the migration history, so while the `drizzle.__drizzle_migrations` ledger table existed, it was completely empty.

## Why that was a problem

The first time we ran `db_migrateProd` (which runs `drizzle-kit` migrate), Drizzle looked at the empty ledger, concluded that no migrations had ever run, and started replaying the journal from the beginning. It got to migration 0001 and failed with:

```
type "audio_type" already exists
```

That is Postgres error 42710. The migration tried to create a type that was already present, because the schema had already been built by push. Drizzle had no record that this work was done, so it tried to do it again.

## Why push is discouraged going forward

`drizzle-kit push` diffs the schema files straight against the live prod database and applies the difference immediately. Two concrete dangers:

1. Destructive prompts on populated tables. Adding a unique constraint to a table that already has rows makes push prompt "truncate table?". Answering yes deletes every row in that table. There is no dry run that is safe to accept blindly.
2. No reviewable trail. Push leaves no `.sql` file to read, review, or roll back. You cannot see what it intends to do before it does it, and you cannot audit it afterward.

The standard workflow now is:

1. `db_gen`: generate the migration and read the produced `.sql` file before doing anything else.
2. `db_migrateProd`: apply the reviewed migration through the migrator, which records each applied migration in the ledger.

## The fix that was applied (one-time baseline)

We baselined the ledger once. A script inserted rows into `drizzle.__drizzle_migrations` marking journal entries 0003 through 0039 as already applied, 37 rows in total. It did this without running any of the migration SQL, since the schema those migrations describe was already present from push.

The hashes were not hand-written: the script used Drizzle's own `readMigrationFiles` to compute the same hash Drizzle would have recorded had it run the migration itself, so the ledger matches what Drizzle expects. The script was guarded to refuse if the ledger was already non-empty, so it could not double-insert or corrupt a real history.

After baselining, `db_migrateProd` works correctly: Drizzle sees migrations 0003 through 0039 as done, skips them, and only applies anything newer.

## Migrator import fix

`apps/vps/src/migrate.ts` had imported the migrator from `drizzle-orm/aws-data-api/pg/migrator`, but this database connects through a node-postgres `Pool`, not the AWS Data API. The import was corrected to `drizzle-orm/node-postgres/migrator` so the migrator talks to the connection the app actually uses.

## What stays and what was removed

The 37 ledger rows in prod are load-bearing and must stay. They are what tell Drizzle the early schema is already in place. Do not delete them.

The helper scripts below were one-shot scaffolding and have been removed from the repo. They are preserved here verbatim in case prod is ever rebuilt. You would only need to re-run the baseline if the ledger were wiped, or if prod were rebuilt with push and then handed over to the migrate workflow again.

### Baseline script (one-shot)

```ts
#!/usr/bin/env bun

import { sql } from 'drizzle-orm'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { db } from '../src/db'

const MIGRATIONS_FOLDER = './drizzle'

await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`)
await db.execute(sql`
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`)

const existing = await db.execute(
  sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`
)
const count = Number(existing.rows[0]?.count ?? 0)

if (count > 0) {
  console.log(`Ledger already has ${count} row(s). Refusing to baseline. No changes made.`)
  process.exit(0)
}

const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER })
console.log(`Baselining ${migrations.length} migration(s) from ${MIGRATIONS_FOLDER}...`)

for (const migration of migrations) {
  await db.execute(
    sql`INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES (${migration.hash}, ${migration.folderMillis})`
  )
}

const after = await db.execute(
  sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at ASC`
)
console.log(`Ledger now has ${after.rows.length} row(s). Baseline complete.`)
console.table(after.rows)

process.exit(0)
```

### Inspect script (read-only)

```ts
#!/usr/bin/env bun

import { sql } from 'drizzle-orm'
import { db } from '../src/db'

const ledgerExists = await db.execute(sql`
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
  ) as present
`)

const present = ledgerExists.rows[0]?.present === true
console.log(`drizzle.__drizzle_migrations exists: ${present}`)

if (present) {
  const rows = await db.execute(sql`
    select id, hash, created_at
    from drizzle.__drizzle_migrations
    order by created_at asc
  `)
  console.log(`rows in ledger: ${rows.rows.length}`)
  console.table(rows.rows)
} else {
  console.log('No ledger table. Prod was built without drizzle migrate (push only).')
}

process.exit(0)
```

### SST DevCommands (removed)

These were registered in `infra/dev.script.ts` and have been removed:

```ts
new sst.x.DevCommand('db_inspectLedger', {
  link: [...allSecrets, email],
  dev: {
    command: 'bun scripts/inspect-migration-ledger.ts',
    directory: './apps/vps',
    autostart: false
  }
})

new sst.x.DevCommand('db_baselineLedger', {
  link: [...allSecrets, email],
  dev: {
    command: 'bun scripts/baseline-migration-ledger.ts',
    directory: './apps/vps',
    autostart: false
  }
})
```
