#!/usr/bin/env bun

import { Pool } from 'pg'
import { config } from '../src/services/config.service'

type Field = 'id' | 'username'

function getArg(name: string) {
  const prefix = `--${name}=`
  return Bun.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

function isField(value: string | undefined): value is Field {
  return value === 'id' || value === 'username'
}

const fieldArg = getArg('field')
const value = getArg('value')

if (!isField(fieldArg) || !value) {
  console.error(
    'Usage: bun scripts/explain-auth-user-query.ts --field=id|username --value=<value>'
  )
  process.exit(1)
}

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  ssl: config.app.stage === 'prod' ? true : { rejectUnauthorized: false }
})

const selectColumns =
  '"id", "name", "email", "email_verified", "image", "bio", "created_at", "updated_at", "username", "display_username", "role", "banned", "ban_reason", "ban_expires"'

const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) select ${selectColumns} from "user" where "user"."${fieldArg}" = $1`

const indexSql = `select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'user' order by indexname`

try {
  const [indexes, explain] = await Promise.all([
    pool.query(indexSql),
    pool.query(explainSql, [value])
  ])

  console.log(`Field: ${fieldArg}`)
  console.log(`Value: ${value}`)
  console.log('')
  console.log('Indexes:')
  console.log(
    indexes.rows.map((row) => `${row.indexname}: ${row.indexdef}`).join('\n')
  )
  console.log('')
  console.log('EXPLAIN ANALYZE:')
  console.log(explain.rows.map((row) => Object.values(row)[0]).join('\n'))
} finally {
  await pool.end()
}
