#!/usr/bin/env bun
/**
 * Verifies a completed migrate-pg-to-d1.ts run: row counts, per-table content
 * checksums over a stable column ordering, referential integrity, and spot
 * checks of the sharp types (uuid identity, timestamp equality, boolean
 * translation, jsonb round-trip, tag/genre order preservation).
 *
 * Reads the same source Postgres and target D1 the migration wrote to, so run
 * it against the same PG_* / D1_PERSIST_PATH environment used for the
 * migration.
 *
 * Usage:
 *   bun run scripts/verify-pg-to-d1.ts [--out <path>]
 */

import type { D1Database } from '@cloudflare/workers-types'
import { Miniflare } from 'miniflare'
import { Client } from 'pg'
import { ARRAY_FAN_OUTS, TABLES, transformValue, type TableSpec } from './migrate-pg-to-d1'

type Row = Record<string, unknown>

const pgConfig = {
  host: process.env.PG_HOST ?? 'localhost',
  port: Number(process.env.PG_PORT ?? 5432),
  user: process.env.PG_USER ?? 'postgres',
  password: process.env.PG_PASSWORD ?? 'postgres',
  database: process.env.PG_DATABASE ?? 'postgres',
  ssl: false as const
}

const persistPath = process.env.D1_PERSIST_PATH ?? './.migration-d1'

const outPathArgIndex = process.argv.indexOf('--out')
const outPath =
  outPathArgIndex !== -1 && process.argv[outPathArgIndex + 1]
    ? process.argv[outPathArgIndex + 1]
    : null

const quoteIdentifier = (identifier: string) => `"${identifier}"`

const openTargetDatabase = async () => {
  const miniflare = new Miniflare({
    script: 'export default { fetch() { return new Response() } }',
    modules: true,
    d1Databases: { DB: 'migration-target' },
    resourcePersistencePath: persistPath === ':memory:' ? undefined : persistPath
  })
  const database = await miniflare.getD1Database('DB')
  return { miniflare, database }
}

const sha256Hex = async (input: string) => {
  const encoded = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Stable per-row string: target-column order, JSON-stringified cell values. */
const rowFingerprint = (row: Row, columns: ReadonlyArray<string>) =>
  columns.map((c) => JSON.stringify(row[c] ?? null)).join('|')

type RowCountResult = {
  readonly table: string
  readonly pgCount: number
  readonly d1Count: number
  readonly match: boolean
}

type ChecksumResult = {
  readonly table: string
  readonly pgChecksum: string
  readonly d1Checksum: string
  readonly match: boolean
}

const fetchPgRows = async (pg: Client, table: TableSpec) => {
  const columns = table.columns.map(
    (c) => `${quoteIdentifier(c.source)} as ${quoteIdentifier(c.target)}`
  )
  const result = await pg.query<Row>(
    `select ${columns.join(', ')} from ${quoteIdentifier(table.source)} order by 1`
  )
  return result.rows.map((row) => {
    const transformed: Row = {}
    for (const c of table.columns) transformed[c.target] = transformValue(row[c.target], c.kind)
    return transformed
  })
}

const fetchD1Rows = async (db: D1Database, table: TableSpec) => {
  const targetColumns = table.columns.map((c) => c.target)
  const columnList = targetColumns.map(quoteIdentifier).join(', ')
  const result = await db
    .prepare(`select ${columnList} from ${quoteIdentifier(table.target)} order by 1`)
    .bind()
    .all<Row>()
  return result.results
}

const verifyTable = async (
  pg: Client,
  db: D1Database,
  table: TableSpec
): Promise<{ counts: RowCountResult; checksum: ChecksumResult }> => {
  const pgRows = await fetchPgRows(pg, table)
  const d1Rows = await fetchD1Rows(db, table)
  const targetColumns = table.columns.map((c) => c.target)

  const pgFingerprints = pgRows.map((row) => rowFingerprint(row, targetColumns)).sort()
  const d1Fingerprints = d1Rows.map((row) => rowFingerprint(row, targetColumns)).sort()

  const pgChecksum = await sha256Hex(pgFingerprints.join('\n'))
  const d1Checksum = await sha256Hex(d1Fingerprints.join('\n'))

  return {
    counts: {
      table: table.target,
      pgCount: pgRows.length,
      d1Count: d1Rows.length,
      match: pgRows.length === d1Rows.length
    },
    checksum: {
      table: table.target,
      pgChecksum,
      d1Checksum,
      match: pgChecksum === d1Checksum
    }
  }
}

type LabelFanOutResult = {
  readonly entityType: string
  readonly pgArrayCells: number
  readonly d1EntityLabelRows: number
  readonly match: boolean
}

type ArrayColumnRow = { readonly values: ReadonlyArray<string> | null }
type CountRow = { readonly c: number }

const verifyArrayFanOuts = async (pg: Client, db: D1Database): Promise<LabelFanOutResult[]> => {
  const results: LabelFanOutResult[] = []
  const byEntityType = new Map<string, { pgArrayCells: number }>()

  for (const fanOut of ARRAY_FAN_OUTS) {
    const result = await pg.query<ArrayColumnRow>(
      `select ${quoteIdentifier(fanOut.column)} as values from ${quoteIdentifier(fanOut.sourceTable)}`
    )
    let cellCount = 0
    for (const row of result.rows) {
      const distinctValues = new Set(row.values ?? [])
      cellCount += distinctValues.size
    }
    const existing = byEntityType.get(fanOut.entityType) ?? { pgArrayCells: 0 }
    byEntityType.set(fanOut.entityType, { pgArrayCells: existing.pgArrayCells + cellCount })
  }

  for (const [entityType, { pgArrayCells }] of byEntityType) {
    const countRow = await db
      .prepare('select count(*) as c from entity_labels where entity_type = ?')
      .bind(entityType)
      .all<CountRow>()
    const d1EntityLabelRows = countRow.results[0]?.c ?? 0
    results.push({
      entityType,
      pgArrayCells,
      d1EntityLabelRows,
      match: pgArrayCells === d1EntityLabelRows
    })
  }

  return results
}

type ReferentialCheck = {
  readonly description: string
  readonly orphanCount: number
  readonly ok: boolean
}

const REFERENTIAL_CHECKS: ReadonlyArray<{ description: string; sql: string }> = [
  {
    description: 'audio.showId -> shows.id',
    sql: 'select count(*) as c from audio where "showId" is not null and "showId" not in (select id from shows)'
  },
  {
    description: 'audio_creators.audioId -> audio.id',
    sql: 'select count(*) as c from audio_creators where "audioId" not in (select id from audio)'
  },
  {
    description: 'audio_creators.creatorId -> user.id',
    sql: 'select count(*) as c from audio_creators where "creatorId" not in (select id from "user")'
  },
  {
    description: 'posts.parent_post_id -> posts.id',
    sql: 'select count(*) as c from posts where parent_post_id is not null and parent_post_id not in (select id from posts)'
  },
  {
    description: 'music_tracks.albumId -> music_albums.id',
    sql: 'select count(*) as c from music_tracks where "albumId" is not null and "albumId" not in (select id from music_albums)'
  },
  {
    description: 'music_album_artists.albumId -> music_albums.id',
    sql: 'select count(*) as c from music_album_artists where "albumId" not in (select id from music_albums)'
  },
  {
    description: 'music_album_artists.artistId -> music_artists.id',
    sql: 'select count(*) as c from music_album_artists where "artistId" not in (select id from music_artists)'
  },
  {
    description: 'music_track_artists.trackId -> music_tracks.id',
    sql: 'select count(*) as c from music_track_artists where "trackId" not in (select id from music_tracks)'
  },
  {
    description: 'music_track_artists.artistId -> music_artists.id',
    sql: 'select count(*) as c from music_track_artists where "artistId" not in (select id from music_artists)'
  },
  {
    description: 'music_label_artists.label_id -> music_labels.id',
    sql: 'select count(*) as c from music_label_artists where label_id not in (select id from music_labels)'
  },
  {
    description: 'releases.labelId -> music_labels.id',
    sql: 'select count(*) as c from releases where "labelId" not in (select id from music_labels)'
  },
  {
    description: 'external_accounts.user_id -> user.id',
    sql: 'select count(*) as c from external_accounts where user_id not in (select id from "user")'
  },
  {
    description: 'external_account_sessions.external_account_id -> external_accounts.id',
    sql: 'select count(*) as c from external_account_sessions where external_account_id not in (select id from external_accounts)'
  },
  {
    description: 'favorites.audio_id -> audio.id',
    sql: 'select count(*) as c from favorites where audio_id is not null and audio_id not in (select id from audio)'
  },
  {
    description: 'entity_labels.label_id -> labels.id',
    sql: 'select count(*) as c from entity_labels where label_id not in (select id from labels)'
  },
  {
    description: 'session.user_id -> user.id',
    sql: 'select count(*) as c from session where user_id not in (select id from "user")'
  },
  {
    description: 'account.user_id -> user.id',
    sql: 'select count(*) as c from account where user_id not in (select id from "user")'
  }
]

const runReferentialChecks = async (db: D1Database): Promise<ReferentialCheck[]> => {
  const checks: ReferentialCheck[] = []
  for (const check of REFERENTIAL_CHECKS) {
    const result = await db.prepare(check.sql).bind().all<CountRow>()
    const orphanCount = result.results[0]?.c ?? 0
    checks.push({ description: check.description, orphanCount, ok: orphanCount === 0 })
  }
  return checks
}

type SpotCheck = { readonly name: string; readonly pass: boolean; readonly detail: string }

type IdRow = { readonly id: string }
type UserTimestampRow = { readonly id: string; readonly updated_at: Date }
type D1TimestampRow = { readonly id: string; readonly updated_at: number }
type UserBooleanRow = { readonly id: string; readonly email_verified: boolean }
type D1BooleanRow = { readonly id: string; readonly email_verified: number }
type CiphertextRow = {
  readonly external_account_id: string
  readonly app_password: unknown
  readonly session: unknown
}
type D1CiphertextRow = {
  readonly external_account_id: string
  readonly app_password: string | null
  readonly session: string | null
}
type MusicLabelArraysRow = {
  readonly id: string
  readonly tags: ReadonlyArray<string> | null
  readonly genres: ReadonlyArray<string> | null
}
type LabelNameRow = { readonly name: string }
type ArtistNamesRow = { readonly id: string; readonly artistNames: ReadonlyArray<string> | null }
type D1ArtistNamesRow = { readonly id: string; readonly artistNames: string | null }

const runSpotChecks = async (pg: Client, db: D1Database): Promise<SpotCheck[]> => {
  const checks: SpotCheck[] = []

  // UUID byte-for-byte identity: compare a known-populated table's PKs verbatim.
  const pgUserIds = await pg.query<IdRow>('select id from "user" order by id')
  const d1UserIdsResult = await db.prepare('select id from "user" order by id').bind().all<IdRow>()
  const d1UserIds = d1UserIdsResult.results.map((r) => r.id)
  const pgUserIdList = pgUserIds.rows.map((r) => r.id)
  checks.push({
    name: 'uuid identity: user.id byte-for-byte',
    pass: JSON.stringify(pgUserIdList) === JSON.stringify(d1UserIds),
    detail: `pg=${JSON.stringify(pgUserIdList)} d1=${JSON.stringify(d1UserIds)}`
  })

  // Timestamp equality: pick a row with an explicit sub-second timestamp.
  const pgTimestamp = await pg.query<UserTimestampRow>(
    'select id, updated_at from "user" where id = $1',
    ['11111111-1111-1111-1111-111111111111']
  )
  const d1Timestamp = await db
    .prepare('select id, updated_at from "user" where id = ?')
    .bind('11111111-1111-1111-1111-111111111111')
    .all<D1TimestampRow>()
  const pgRow = pgTimestamp.rows[0]
  const d1Row = d1Timestamp.results[0]
  const pgEpochMs = pgRow ? new Date(pgRow.updated_at).getTime() : null
  checks.push({
    name: 'timestamp equality: user.updated_at epoch ms, sub-second precision preserved',
    pass: pgEpochMs !== null && d1Row !== undefined && pgEpochMs === d1Row.updated_at,
    detail: `pg_epoch_ms=${pgEpochMs} d1_epoch_ms=${d1Row?.updated_at}`
  })

  // Boolean translation: 0/1 in D1 matches boolean in Postgres.
  const pgBoolean = await pg.query<UserBooleanRow>(
    'select id, email_verified from "user" order by id'
  )
  const d1BooleanResult = await db
    .prepare('select id, email_verified from "user" order by id')
    .bind()
    .all<D1BooleanRow>()
  const pgBooleans = pgBoolean.rows.map((r) => ({ id: r.id, value: r.email_verified ? 1 : 0 }))
  const d1Booleans = d1BooleanResult.results.map((r) => ({ id: r.id, value: r.email_verified }))
  const booleansMatch =
    pgBooleans.length === d1Booleans.length &&
    pgBooleans.every((row, i) => row.id === d1Booleans[i]?.id && row.value === d1Booleans[i]?.value)
  checks.push({
    name: 'boolean translation: user.email_verified 0/1',
    pass: booleansMatch,
    detail: `pg=${JSON.stringify(pgBooleans)} d1=${JSON.stringify(d1Booleans)}`
  })

  // jsonb round-trip: CiphertextEnvelope on external_account_sessions.
  const pgCiphertext = await pg.query<CiphertextRow>(
    'select external_account_id, app_password, session from external_account_sessions order by external_account_id'
  )
  const d1CiphertextResult = await db
    .prepare(
      'select external_account_id, app_password, session from external_account_sessions order by external_account_id'
    )
    .bind()
    .all<D1CiphertextRow>()
  const ciphertextMatches =
    pgCiphertext.rows.length === d1CiphertextResult.results.length &&
    pgCiphertext.rows.every((pgRow, i) => {
      const d1RowAt = d1CiphertextResult.results[i]
      if (!d1RowAt) return false
      const d1AppPassword = d1RowAt.app_password ? JSON.parse(d1RowAt.app_password) : null
      const d1Session = d1RowAt.session ? JSON.parse(d1RowAt.session) : null
      return (
        JSON.stringify(pgRow.app_password) === JSON.stringify(d1AppPassword) &&
        JSON.stringify(pgRow.session) === JSON.stringify(d1Session)
      )
    })
  checks.push({
    name: 'jsonb round-trip: CiphertextEnvelope (app_password, session) exact match',
    pass: ciphertextMatches,
    detail: `checked ${pgCiphertext.rows.length} external_account_sessions row(s)`
  })

  // Tag order preservation: music_labels has both tags and genres arrays.
  const pgLabelArrays = await pg.query<MusicLabelArraysRow>(
    'select id, tags, genres from music_labels order by id'
  )
  const orderChecks: string[] = []
  let orderOk = true
  for (const row of pgLabelArrays.rows) {
    for (const [kind, values] of [
      ['tag', row.tags],
      ['genre', row.genres]
    ] as const) {
      const expectedOrder = [...new Set(values ?? [])]
      const d1Order = await db
        .prepare(
          `select labels.name from entity_labels
           inner join labels on labels.id = entity_labels.label_id
           where entity_labels.entity_type = 'musicLabel' and entity_labels.entity_id = ?
             and labels.kind = ?
           order by entity_labels.position`
        )
        .bind(row.id, kind)
        .all<LabelNameRow>()
      const actualOrder = d1Order.results.map((r) => r.name)
      const matches = JSON.stringify(expectedOrder) === JSON.stringify(actualOrder)
      orderOk = orderOk && matches
      orderChecks.push(
        `${row.id}/${kind}: expected=${JSON.stringify(expectedOrder)} actual=${JSON.stringify(actualOrder)} match=${matches}`
      )
    }
  }
  checks.push({
    name: 'tag/genre order preservation: music_labels.tags and .genres via entity_labels.position',
    pass: orderOk,
    detail: orderChecks.join('; ')
  })

  // artistNames: denormalized JSON column, NOT fanned out, order preserved verbatim.
  const pgArtistNames = await pg.query<ArtistNamesRow>(
    'select id, "artistNames" from music_tracks order by id'
  )
  const d1ArtistNamesResult = await db
    .prepare('select id, "artistNames" from music_tracks order by id')
    .bind()
    .all<D1ArtistNamesRow>()
  const artistNamesMatch =
    pgArtistNames.rows.length === d1ArtistNamesResult.results.length &&
    pgArtistNames.rows.every((pgRow, i) => {
      const d1RowAt = d1ArtistNamesResult.results[i]
      if (!d1RowAt) return false
      const d1Parsed = d1RowAt.artistNames ? JSON.parse(d1RowAt.artistNames) : null
      return JSON.stringify(pgRow.artistNames) === JSON.stringify(d1Parsed)
    })
  checks.push({
    name: 'artistNames stays denormalized JSON text, order preserved verbatim (not fanned out)',
    pass: artistNamesMatch,
    detail: `checked ${pgArtistNames.rows.length} music_tracks row(s)`
  })

  return checks
}

const renderMarkdown = (params: {
  readonly usedRealProductionData: boolean
  readonly rowCounts: ReadonlyArray<RowCountResult>
  readonly checksums: ReadonlyArray<ChecksumResult>
  readonly fanOuts: ReadonlyArray<LabelFanOutResult>
  readonly referential: ReadonlyArray<ReferentialCheck>
  readonly spotChecks: ReadonlyArray<SpotCheck>
}) => {
  const { rowCounts, checksums, fanOuts, referential, spotChecks } = params
  const rowCountMismatches = rowCounts.filter((r) => !r.match)
  const checksumMismatches = checksums.filter((c) => !c.match)
  const fanOutMismatches = fanOuts.filter((f) => !f.match)
  const referentialFailures = referential.filter((r) => !r.ok)
  const spotCheckFailures = spotChecks.filter((s) => !s.pass)

  const lines: string[] = []
  lines.push('# D1 migration verification (OPS-249)')
  lines.push('')
  lines.push(`Generated ${new Date().toISOString()}.`)
  lines.push('')
  lines.push(
    params.usedRealProductionData
      ? '**Data source: real production Postgres (read-only).**'
      : '**Data source: synthetic local Postgres clone, not production data.** ' +
          'No production database was reached in this environment. See `docs/migrations/evidence/d1-cutover-readiness.md` ' +
          'for what that does and does not prove.'
  )
  lines.push('')

  lines.push('## Row counts (Postgres vs D1)')
  lines.push('')
  lines.push('| Table | Postgres | D1 | Match |')
  lines.push('| --- | --- | --- | --- |')
  for (const r of rowCounts) {
    lines.push(`| ${r.table} | ${r.pgCount} | ${r.d1Count} | ${r.match ? 'yes' : '**MISMATCH**'} |`)
  }
  lines.push('')
  lines.push(
    rowCountMismatches.length === 0
      ? `All ${rowCounts.length} tables match on row count.`
      : `**${rowCountMismatches.length} table(s) mismatch on row count: ${rowCountMismatches.map((r) => r.table).join(', ')}.**`
  )
  lines.push('')

  lines.push('## Content checksums (stable column ordering, SHA-256 over sorted row fingerprints)')
  lines.push('')
  lines.push('| Table | Match |')
  lines.push('| --- | --- |')
  for (const c of checksums) {
    lines.push(
      `| ${c.table} | ${c.match ? 'yes' : `**MISMATCH** (pg=${c.pgChecksum.slice(0, 12)}... d1=${c.d1Checksum.slice(0, 12)}...)`} |`
    )
  }
  lines.push('')
  lines.push(
    checksumMismatches.length === 0
      ? `All ${checksums.length} tables match on content checksum.`
      : `**${checksumMismatches.length} table(s) mismatch on content checksum: ${checksumMismatches.map((c) => c.table).join(', ')}.**`
  )
  lines.push('')

  lines.push('## Array column fan-out: labels / entity_labels')
  lines.push('')
  lines.push(
    'Distinct array cells in Postgres source columns vs entity_labels rows in D1, by entity type.'
  )
  lines.push('')
  lines.push('| Entity type | Postgres distinct cells | D1 entity_labels rows | Match |')
  lines.push('| --- | --- | --- | --- |')
  for (const f of fanOuts) {
    lines.push(
      `| ${f.entityType} | ${f.pgArrayCells} | ${f.d1EntityLabelRows} | ${f.match ? 'yes' : '**MISMATCH**'} |`
    )
  }
  lines.push('')
  lines.push(
    fanOutMismatches.length === 0
      ? 'All entity types match between source array cells and entity_labels rows.'
      : `**${fanOutMismatches.length} entity type(s) mismatch: ${fanOutMismatches.map((f) => f.entityType).join(', ')}.**`
  )
  lines.push('')

  lines.push('## Referential integrity (every checked foreign key resolves)')
  lines.push('')
  lines.push('| Check | Orphan rows | OK |')
  lines.push('| --- | --- | --- |')
  for (const r of referential) {
    lines.push(`| ${r.description} | ${r.orphanCount} | ${r.ok ? 'yes' : '**FAIL**'} |`)
  }
  lines.push('')
  lines.push(
    referentialFailures.length === 0
      ? `All ${referential.length} referential integrity checks pass.`
      : `**${referentialFailures.length} referential integrity check(s) failed: ${referentialFailures.map((r) => r.description).join(', ')}.**`
  )
  lines.push('')

  lines.push('## Sharp-type spot checks')
  lines.push('')
  for (const s of spotChecks) {
    lines.push(`### ${s.pass ? 'PASS' : 'FAIL'}: ${s.name}`)
    lines.push('')
    lines.push(s.detail)
    lines.push('')
  }
  lines.push(
    spotCheckFailures.length === 0
      ? `All ${spotChecks.length} sharp-type spot checks pass.`
      : `**${spotCheckFailures.length} sharp-type spot check(s) failed: ${spotCheckFailures.map((s) => s.name).join(', ')}.**`
  )
  lines.push('')

  const overallPass =
    rowCountMismatches.length === 0 &&
    checksumMismatches.length === 0 &&
    fanOutMismatches.length === 0 &&
    referentialFailures.length === 0 &&
    spotCheckFailures.length === 0

  lines.push('## Overall result')
  lines.push('')
  lines.push(
    overallPass ? '**PASS** — all checks above passed.' : '**FAIL** — see mismatches above.'
  )
  lines.push('')

  return lines.join('\n')
}

const main = async () => {
  const pg = new Client(pgConfig)
  await pg.connect()
  const { miniflare, database } = await openTargetDatabase()

  try {
    const rowCounts: RowCountResult[] = []
    const checksums: ChecksumResult[] = []
    for (const table of TABLES) {
      const { counts, checksum } = await verifyTable(pg, database, table)
      rowCounts.push(counts)
      checksums.push(checksum)
      console.log(
        `[verify] ${table.target}: rows pg=${counts.pgCount} d1=${counts.d1Count} match=${counts.match}, checksum match=${checksum.match}`
      )
    }

    const fanOuts = await verifyArrayFanOuts(pg, database)
    for (const f of fanOuts) {
      console.log(
        `[verify] fan-out ${f.entityType}: pg_cells=${f.pgArrayCells} d1_rows=${f.d1EntityLabelRows} match=${f.match}`
      )
    }

    const referential = await runReferentialChecks(database)
    for (const r of referential) {
      console.log(`[verify] referential ${r.description}: orphans=${r.orphanCount} ok=${r.ok}`)
    }

    const spotChecks = await runSpotChecks(pg, database)
    for (const s of spotChecks) {
      console.log(`[verify] spot check "${s.name}": pass=${s.pass}`)
    }

    const markdown = renderMarkdown({
      usedRealProductionData: process.env.MIGRATION_USED_PRODUCTION_DATA === 'true',
      rowCounts,
      checksums,
      fanOuts,
      referential,
      spotChecks
    })

    if (outPath) {
      await Bun.write(outPath, markdown)
      console.log(`[verify] wrote report to ${outPath}`)
    } else {
      console.log(markdown)
    }

    const failed =
      rowCounts.some((r) => !r.match) ||
      checksums.some((c) => !c.match) ||
      fanOuts.some((f) => !f.match) ||
      referential.some((r) => !r.ok) ||
      spotChecks.some((s) => !s.pass)

    if (failed) {
      console.error('[verify] one or more checks failed, see report above')
      process.exitCode = 1
    }
  } finally {
    await pg.end()
    await miniflare.dispose()
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('[verify] failed', error)
    process.exit(1)
  })
}
