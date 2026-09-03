import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
import { Effect } from 'effect'
import type { DatabaseClient } from '@/db/layer'
import { getErrorMessage } from '@/errors'
import { MusicIdentityStorageError, MusicSourceInvalid } from './errors'
import {
  CANONICAL_MUSIC_ENTITY_TYPES,
  parseMusicSource,
  type CanonicalMusicEntityType,
  type ParsedMusicSource
} from './music-source'

const BACKFILL_OPERATION = 'canonical_music_identity_v2'
const DEFAULT_BATCH_SIZE = 25
const MAX_BATCH_SIZE = 50
const MAX_APPLY_SOURCE_KEYS = 5
const MAX_CANDIDATES_PER_SOURCE_KEY = 100

type Phase = 'scan_links' | 'scan_claims' | 'apply' | 'complete'
type Origin = 'link' | 'legacy_claim'

type LinkRow = {
  readonly id: string
  readonly entityType: string
  readonly entityId: string
  readonly platform: string
  readonly url: string
  readonly status: string
  readonly scrapedAt: number | null
  readonly verifiedAt: number | null
  readonly createdAt: number
  readonly entityExists: number
}

type ClaimRow = {
  readonly entityType: string
  readonly canonicalUrl: string
  readonly entityId: string
  readonly updatedAt: number
  readonly createdAt: number
  readonly entityExists: number
}

type RunRow = {
  readonly generationId: string
  readonly phase: Phase
  readonly linkHighWaterCreatedAt: number
  readonly linkHighWaterId: string
  readonly claimHighWaterUpdatedAt: number
  readonly claimHighWaterEntityType: string
  readonly claimHighWaterCanonicalUrl: string
  readonly cursorCreatedAt: number
  readonly cursorId: string
  readonly claimCursorUpdatedAt: number
  readonly claimCursorEntityType: string
  readonly claimCursorCanonicalUrl: string
  readonly applyCursorSourceKey: string
  readonly scannedCount: number
  readonly candidateCount: number
  readonly attemptedCount: number
  readonly invalidCount: number
  readonly orphanCount: number
}

type StagedCandidate = {
  readonly origin: Origin
  readonly originKey: string
  readonly sourceUrl: string
  readonly source: ParsedMusicSource
  readonly entityType: CanonicalMusicEntityType
  readonly entityId: string
  readonly status: string
  readonly verifiedAt: number | null
  readonly scrapedAt: number | null
  readonly createdAt: number
  readonly entityExists: boolean
}

export type IdentityMaintenanceIssue = {
  readonly category:
    | 'collision'
    | 'invalid_source'
    | 'mismatched_entity_type'
    | 'orphaned_identity'
    | 'orphaned_alias'
    | 'orphaned_link'
    | 'duplicate_ownership_candidate'
    | 'candidate_overflow'
    | 'resolving_lease'
    | 'expired_lease'
  readonly sourceKey?: string
  readonly linkId?: string
  readonly entityType?: string
  readonly entityId?: string
  readonly detail: string
}

export type IdentityBackfillSummary = {
  readonly mode: 'backfill'
  readonly dryRun: boolean
  readonly generationId: string | null
  readonly phase: Phase | 'preview'
  readonly batchSize: number
  readonly complete: boolean
  readonly cursor: string | null
  readonly scanned: number
  readonly candidates: number
  readonly proposed: number
  readonly attempted: number
  readonly detected: number
  readonly identitiesCreated: number
  readonly aliasesCreated: number
  readonly aliasesTouched: number
  readonly invalid: number
  readonly orphaned: number
  readonly issues: ReadonlyArray<IdentityMaintenanceIssue>
}

export type IdentityAuditPhase =
  | 'links'
  | 'identities'
  | 'aliases'
  | 'conflicts'
  | 'leases'
  | 'findings'

export type IdentityAuditSummary = {
  readonly mode: 'audit'
  readonly phase: IdentityAuditPhase
  readonly batchSize: number
  readonly complete: boolean
  readonly cursor: string | null
  readonly scanned: number
  readonly detected: number
  readonly issues: ReadonlyArray<IdentityMaintenanceIssue>
}

export type IdentityBackfillOptions = {
  readonly apply?: boolean
  readonly batchSize?: number
  readonly generationId?: string
  readonly cursor?: { readonly createdAt: number; readonly id: string }
  readonly now?: Date
}

export type IdentityAuditOptions = {
  readonly batchSize?: number
  readonly phase?: IdentityAuditPhase
  readonly cursor?: string
  readonly generationId?: string
  readonly now?: Date
}

const storageError = (operation: string, cause: unknown) =>
  new MusicIdentityStorageError({ operation, message: getErrorMessage(cause) })

const attempt = <A>(operation: string, work: () => Promise<A>) =>
  Effect.tryPromise({ try: work, catch: (cause) => storageError(operation, cause) })

const canonicalEntityType = (value: string): CanonicalMusicEntityType | undefined =>
  CANONICAL_MUSIC_ENTITY_TYPES.find((entityType) => entityType === value)

const validatedBatchSize = (value: number | undefined) => {
  const size = value ?? DEFAULT_BATCH_SIZE
  if (!Number.isInteger(size) || size < 1 || size > MAX_BATCH_SIZE) {
    return Effect.fail(
      new MusicIdentityStorageError({
        operation: 'validateBatchSize',
        message: `Batch size must be an integer between 1 and ${MAX_BATCH_SIZE}`
      })
    )
  }
  return Effect.succeed(size)
}

const entityExistsSql = (alias: string, entityIdColumn = 'entity_id') => `(
  (${alias}.entity_type = 'artist' AND EXISTS (SELECT 1 FROM music_artists e WHERE e.id = ${alias}.${entityIdColumn})) OR
  (${alias}.entity_type = 'album' AND EXISTS (SELECT 1 FROM music_albums e WHERE e.id = ${alias}.${entityIdColumn})) OR
  (${alias}.entity_type = 'track' AND EXISTS (SELECT 1 FROM music_tracks e WHERE e.id = ${alias}.${entityIdColumn})) OR
  (${alias}.entity_type = 'playlist' AND EXISTS (SELECT 1 FROM music_playlists e WHERE e.id = ${alias}.${entityIdColumn}))
)`

const readLinkPage = (
  database: D1Database,
  cursor: { readonly createdAt: number; readonly id: string },
  highWater: { readonly createdAt: number; readonly id: string } | null,
  batchSize: number
) =>
  attempt('readLinkPage', async () => {
    const highWaterClause = highWater
      ? 'AND (l.createdAt < ? OR (l.createdAt = ? AND l.id <= ?))'
      : ''
    const statement = database.prepare(
      `SELECT l.id, l.entity_type AS entityType, l.entityId, l.platform, l.url, l.status,
         l.scrapedAt, l.verifiedAt, l.createdAt, ${entityExistsSql('l', 'entityId')} AS entityExists
       FROM music_entity_links l
       WHERE (l.createdAt > ? OR (l.createdAt = ? AND l.id > ?)) ${highWaterClause}
       ORDER BY l.createdAt, l.id LIMIT ?`
    )
    const bound = highWater
      ? statement.bind(
          cursor.createdAt,
          cursor.createdAt,
          cursor.id,
          highWater.createdAt,
          highWater.createdAt,
          highWater.id,
          batchSize
        )
      : statement.bind(cursor.createdAt, cursor.createdAt, cursor.id, batchSize)
    return (await bound.all<LinkRow>()).results
  })

const readClaimPage = (database: D1Database, run: RunRow, batchSize: number) =>
  attempt(
    'readClaimPage',
    async () =>
      (
        await database
          .prepare(
            `SELECT c.entity_type AS entityType, c.canonical_url AS canonicalUrl,
             c.entity_id AS entityId, c.updated_at AS updatedAt, c.created_at AS createdAt,
             ${entityExistsSql('c')} AS entityExists
           FROM music_entity_resolution_claims c
           WHERE c.entity_id IS NOT NULL
             AND (c.updated_at > ? OR (c.updated_at = ? AND c.entity_type > ?) OR
               (c.updated_at = ? AND c.entity_type = ? AND c.canonical_url > ?))
             AND (c.updated_at < ? OR (c.updated_at = ? AND c.entity_type < ?) OR
               (c.updated_at = ? AND c.entity_type = ? AND c.canonical_url <= ?))
           ORDER BY c.updated_at, c.entity_type, c.canonical_url LIMIT ?`
          )
          .bind(
            run.claimCursorUpdatedAt,
            run.claimCursorUpdatedAt,
            run.claimCursorEntityType,
            run.claimCursorUpdatedAt,
            run.claimCursorEntityType,
            run.claimCursorCanonicalUrl,
            run.claimHighWaterUpdatedAt,
            run.claimHighWaterUpdatedAt,
            run.claimHighWaterEntityType,
            run.claimHighWaterUpdatedAt,
            run.claimHighWaterEntityType,
            run.claimHighWaterCanonicalUrl,
            batchSize
          )
          .all<ClaimRow>()
      ).results
  )

const parseSourceResult = (url: string, entityType: CanonicalMusicEntityType) =>
  parseMusicSource(url, entityType).pipe(
    Effect.map((source) => ({ _tag: 'valid' as const, source })),
    Effect.catchTag('MusicSourceInvalid', (error) =>
      Effect.succeed({ _tag: 'invalid' as const, error })
    )
  )

const parseCandidate = (input: Omit<StagedCandidate, 'source'> & { readonly sourceUrl: string }) =>
  parseSourceResult(input.sourceUrl, input.entityType).pipe(
    Effect.map((result) =>
      result._tag === 'valid'
        ? { _tag: 'candidate' as const, candidate: { ...input, source: result.source } }
        : { _tag: 'invalid' as const, error: result.error }
    )
  )

const readRun = (database: D1Database, generationId?: string) =>
  attempt('readMaintenanceRun', () => {
    const statement = database.prepare(
      `SELECT generation_id AS generationId, phase,
         link_high_water_created_at AS linkHighWaterCreatedAt,
         link_high_water_id AS linkHighWaterId,
         claim_high_water_updated_at AS claimHighWaterUpdatedAt,
         claim_high_water_entity_type AS claimHighWaterEntityType,
         claim_high_water_canonical_url AS claimHighWaterCanonicalUrl,
         cursor_created_at AS cursorCreatedAt, cursor_id AS cursorId,
         claim_cursor_updated_at AS claimCursorUpdatedAt,
         claim_cursor_entity_type AS claimCursorEntityType,
         claim_cursor_canonical_url AS claimCursorCanonicalUrl,
         apply_cursor_source_key AS applyCursorSourceKey,
         scanned_count AS scannedCount, candidate_count AS candidateCount,
         attempted_count AS attemptedCount, invalid_count AS invalidCount,
         orphan_count AS orphanCount
       FROM music_identity_maintenance_runs
       WHERE ${generationId ? 'generation_id = ?' : 'operation = ? AND active = 1'} LIMIT 1`
    )
    return statement.bind(generationId ?? BACKFILL_OPERATION).first<RunRow>()
  })

const initializeRun = (database: D1Database, now: number) =>
  Effect.gen(function* () {
    const linkHighWater = yield* attempt('readLinkHighWater', () =>
      database
        .prepare(
          'SELECT createdAt, id FROM music_entity_links ORDER BY createdAt DESC, id DESC LIMIT 1'
        )
        .first<{ readonly createdAt: number; readonly id: string }>()
    )
    const claimHighWater = yield* attempt('readClaimHighWater', () =>
      database
        .prepare(
          `SELECT updated_at AS updatedAt, entity_type AS entityType, canonical_url AS canonicalUrl
           FROM music_entity_resolution_claims WHERE entity_id IS NOT NULL
           ORDER BY updated_at DESC, entity_type DESC, canonical_url DESC LIMIT 1`
        )
        .first<{
          readonly updatedAt: number
          readonly entityType: string
          readonly canonicalUrl: string
        }>()
    )
    const generationId = crypto.randomUUID()
    yield* attempt('initializeMaintenanceRun', () =>
      database
        .prepare(
          `INSERT INTO music_identity_maintenance_runs (
             generation_id, operation, phase, active, link_high_water_created_at,
             link_high_water_id, claim_high_water_updated_at, claim_high_water_entity_type,
             claim_high_water_canonical_url, cursor_created_at, cursor_id,
             claim_cursor_updated_at, claim_cursor_entity_type, claim_cursor_canonical_url,
             apply_cursor_source_key, created_at, updated_at
           ) VALUES (?, ?, 'scan_links', 1, ?, ?, ?, ?, ?, -1, '', -1, '', '', '', ?, ?)`
        )
        .bind(
          generationId,
          BACKFILL_OPERATION,
          linkHighWater?.createdAt ?? -1,
          linkHighWater?.id ?? '',
          claimHighWater?.updatedAt ?? -1,
          claimHighWater?.entityType ?? '',
          claimHighWater?.canonicalUrl ?? '',
          now,
          now
        )
        .run()
    )
    const run = yield* readRun(database, generationId)
    if (!run) return yield* Effect.fail(storageError('initializeMaintenanceRun', 'Run missing'))
    return run
  })

const findingStatement = (
  database: D1Database,
  generationId: string,
  findingKey: string,
  issue: IdentityMaintenanceIssue,
  now: number
) =>
  database
    .prepare(
      `INSERT OR IGNORE INTO music_identity_maintenance_findings (
         generation_id, finding_key, category, source_key, origin_key,
         entity_type, entity_id, detail, detected_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      generationId,
      findingKey,
      issue.category,
      issue.sourceKey ?? null,
      issue.linkId ?? null,
      issue.entityType ?? null,
      issue.entityId ?? null,
      issue.detail,
      now
    )

const stageStatement = (database: D1Database, generationId: string, candidate: StagedCandidate) =>
  database
    .prepare(
      `INSERT OR IGNORE INTO music_identity_maintenance_candidates (
         generation_id, source_key, origin, origin_key, platform, source_entity_type,
         external_id, canonical_url, source_url, normalized_url, entity_type, entity_id,
         status, verified_at, scraped_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      generationId,
      candidate.source.sourceKey,
      candidate.origin,
      candidate.originKey,
      candidate.source.platform,
      candidate.source.sourceEntityType,
      candidate.source.externalId,
      candidate.source.canonicalUrl,
      candidate.sourceUrl,
      candidate.source.normalizedUrl,
      candidate.entityType,
      candidate.entityId,
      candidate.status,
      candidate.verifiedAt,
      candidate.scrapedAt,
      candidate.createdAt
    )

const sourceKeyStatement = (database: D1Database, generationId: string, sourceKey: string) =>
  database
    .prepare(
      `INSERT OR IGNORE INTO music_identity_maintenance_source_keys
         (generation_id, source_key) VALUES (?, ?)`
    )
    .bind(generationId, sourceKey)

const issueForInvalid = (
  originKey: string,
  entityType: string,
  entityId: string,
  error: MusicSourceInvalid
): IdentityMaintenanceIssue => ({
  category: error.reason === 'type_mismatch' ? 'mismatched_entity_type' : 'invalid_source',
  linkId: originKey,
  entityType,
  entityId,
  detail: error.reason
})

const scanLinks = (database: D1Database, run: RunRow, batchSize: number, now: number) =>
  Effect.gen(function* () {
    const rows = yield* readLinkPage(
      database,
      { createdAt: run.cursorCreatedAt, id: run.cursorId },
      { createdAt: run.linkHighWaterCreatedAt, id: run.linkHighWaterId },
      batchSize
    )
    const statements: D1PreparedStatement[] = []
    const issues: IdentityMaintenanceIssue[] = []
    let candidateCount = 0
    let invalidCount = 0
    let orphanCount = 0
    for (const row of rows) {
      const entityType = canonicalEntityType(row.entityType)
      if (!entityType) {
        const issue: IdentityMaintenanceIssue = {
          category: 'invalid_source',
          linkId: row.id,
          entityType: row.entityType,
          entityId: row.entityId,
          detail: 'Unsupported canonical music entity type'
        }
        issues.push(issue)
        statements.push(
          findingStatement(database, run.generationId, `invalid:${row.id}`, issue, now)
        )
        invalidCount += 1
        continue
      }
      const parsed = yield* parseCandidate({
        origin: 'link',
        originKey: row.id,
        sourceUrl: row.url,
        entityType,
        entityId: row.entityId,
        status: row.status,
        verifiedAt: row.verifiedAt,
        scrapedAt: row.scrapedAt,
        createdAt: row.createdAt,
        entityExists: row.entityExists === 1
      })
      if (parsed._tag === 'invalid' || parsed.candidate.source.platform !== row.platform) {
        const issue =
          parsed._tag === 'invalid'
            ? issueForInvalid(row.id, row.entityType, row.entityId, parsed.error)
            : {
                category: 'invalid_source' as const,
                linkId: row.id,
                entityType: row.entityType,
                entityId: row.entityId,
                detail: 'platform_mismatch'
              }
        issues.push(issue)
        statements.push(
          findingStatement(database, run.generationId, `invalid:${row.id}`, issue, now)
        )
        invalidCount += 1
      } else {
        statements.push(
          sourceKeyStatement(database, run.generationId, parsed.candidate.source.sourceKey),
          stageStatement(database, run.generationId, parsed.candidate)
        )
        candidateCount += 1
      }
      if (row.entityExists !== 1) {
        const issue: IdentityMaintenanceIssue = {
          category: 'orphaned_link',
          linkId: row.id,
          entityType: row.entityType,
          entityId: row.entityId,
          detail: 'Link references a missing music entity'
        }
        issues.push(issue)
        statements.push(
          findingStatement(database, run.generationId, `orphan:${row.id}`, issue, now)
        )
        orphanCount += 1
      }
    }
    const last = rows.at(-1)
    const reachedHighWater =
      !last || (last.createdAt === run.linkHighWaterCreatedAt && last.id === run.linkHighWaterId)
    statements.push(
      database
        .prepare(
          `UPDATE music_identity_maintenance_runs SET phase = ?, cursor_created_at = ?,
             cursor_id = ?, scanned_count = scanned_count + ?,
             candidate_count = candidate_count + ?, invalid_count = invalid_count + ?,
             orphan_count = orphan_count + ?, updated_at = ? WHERE generation_id = ?`
        )
        .bind(
          reachedHighWater ? 'scan_claims' : 'scan_links',
          last?.createdAt ?? run.cursorCreatedAt,
          last?.id ?? run.cursorId,
          rows.length,
          candidateCount,
          invalidCount,
          orphanCount,
          now,
          run.generationId
        )
    )
    yield* attempt('stageLinkPage', () => database.batch(statements))
    return issues
  })

const scanClaims = (database: D1Database, run: RunRow, batchSize: number, now: number) =>
  Effect.gen(function* () {
    const rows = yield* readClaimPage(database, run, batchSize)
    const statements: D1PreparedStatement[] = []
    const issues: IdentityMaintenanceIssue[] = []
    let candidateCount = 0
    let invalidCount = 0
    let orphanCount = 0
    for (const row of rows) {
      const entityType = canonicalEntityType(row.entityType)
      if (!entityType) continue
      const originKey = `${row.entityType}:${row.canonicalUrl}`
      const parsed = yield* parseCandidate({
        origin: 'legacy_claim',
        originKey,
        sourceUrl: row.canonicalUrl,
        entityType,
        entityId: row.entityId,
        status: 'legacy_completed',
        verifiedAt: null,
        scrapedAt: null,
        createdAt: row.createdAt,
        entityExists: row.entityExists === 1
      })
      if (parsed._tag === 'invalid') {
        const issue = issueForInvalid(originKey, row.entityType, row.entityId, parsed.error)
        issues.push(issue)
        statements.push(
          findingStatement(database, run.generationId, `invalid-claim:${originKey}`, issue, now)
        )
        invalidCount += 1
      } else {
        statements.push(
          sourceKeyStatement(database, run.generationId, parsed.candidate.source.sourceKey),
          stageStatement(database, run.generationId, parsed.candidate)
        )
        candidateCount += 1
      }
      if (row.entityExists !== 1) {
        const issue: IdentityMaintenanceIssue = {
          category: 'orphaned_link',
          linkId: originKey,
          entityType: row.entityType,
          entityId: row.entityId,
          detail: 'Completed legacy claim references a missing music entity'
        }
        issues.push(issue)
        statements.push(
          findingStatement(database, run.generationId, `orphan-claim:${originKey}`, issue, now)
        )
        orphanCount += 1
      }
    }
    const last = rows.at(-1)
    const reachedHighWater =
      !last ||
      (last.updatedAt === run.claimHighWaterUpdatedAt &&
        last.entityType === run.claimHighWaterEntityType &&
        last.canonicalUrl === run.claimHighWaterCanonicalUrl)
    statements.push(
      database
        .prepare(
          `UPDATE music_identity_maintenance_runs SET phase = ?, claim_cursor_updated_at = ?,
             claim_cursor_entity_type = ?, claim_cursor_canonical_url = ?,
             scanned_count = scanned_count + ?, candidate_count = candidate_count + ?,
             invalid_count = invalid_count + ?, orphan_count = orphan_count + ?, updated_at = ?
           WHERE generation_id = ?`
        )
        .bind(
          reachedHighWater ? 'apply' : 'scan_claims',
          last?.updatedAt ?? run.claimCursorUpdatedAt,
          last?.entityType ?? run.claimCursorEntityType,
          last?.canonicalUrl ?? run.claimCursorCanonicalUrl,
          rows.length,
          candidateCount,
          invalidCount,
          orphanCount,
          now,
          run.generationId
        )
    )
    yield* attempt('stageClaimPage', () => database.batch(statements))
    return issues
  })

const eligibleWinnerCte = `WITH candidate_window AS MATERIALIZED (
  SELECT c.* FROM music_identity_maintenance_candidates c
  WHERE c.generation_id = ? AND c.source_key = ?
  ORDER BY c.origin, c.origin_key LIMIT ${MAX_CANDIDATES_PER_SOURCE_KEY + 1}
), overflow AS (
  SELECT 1 FROM candidate_window LIMIT 1 OFFSET ${MAX_CANDIDATES_PER_SOURCE_KEY}
), eligible AS (
  SELECT c.generation_id, c.source_key, c.origin, c.origin_key, l.platform,
    c.source_entity_type, c.external_id, c.canonical_url, c.source_url,
    c.normalized_url, c.entity_type, c.entity_id, l.status,
    l.verifiedAt AS verified_at, l.scrapedAt AS scraped_at, l.createdAt AS created_at
  FROM candidate_window c JOIN music_entity_links l ON l.id = c.origin_key
  WHERE c.origin = 'link' AND NOT EXISTS (SELECT 1 FROM overflow)
    AND l.entity_type = c.entity_type AND l.entityId = c.entity_id
    AND l.url = c.source_url AND l.platform = c.platform AND ${entityExistsSql('c')}
  UNION ALL
  SELECT c.generation_id, c.source_key, c.origin, c.origin_key, c.platform,
    c.source_entity_type, c.external_id, c.canonical_url, c.source_url,
    c.normalized_url, c.entity_type, r.entity_id, c.status,
    c.verified_at, c.scraped_at, r.created_at
  FROM candidate_window c JOIN music_entity_resolution_claims r
    ON r.entity_type || ':' || r.canonical_url = c.origin_key
  WHERE c.origin = 'legacy_claim' AND NOT EXISTS (SELECT 1 FROM overflow)
    AND r.entity_id IS NOT NULL AND r.entity_id = c.entity_id
    AND r.canonical_url = c.source_url AND ${entityExistsSql('r')}
), winner AS (
  SELECT * FROM eligible ORDER BY CASE origin WHEN 'link' THEN 0 ELSE 1 END,
    CASE status WHEN 'verified' THEN 0 ELSE 1 END,
    COALESCE(verified_at, 9223372036854775807),
    COALESCE(scraped_at, 9223372036854775807), created_at, origin_key LIMIT 1
)`

const applyStatementsForKey = (
  database: D1Database,
  generationId: string,
  sourceKey: string,
  now: number
): ReadonlyArray<D1PreparedStatement> => {
  const bindWinner = (sql: string, ...params: ReadonlyArray<unknown>) =>
    database.prepare(`${eligibleWinnerCte} ${sql}`).bind(generationId, sourceKey, ...params)
  return [
    database
      .prepare(
        `INSERT OR IGNORE INTO music_identity_maintenance_findings (
           generation_id, finding_key, category, source_key, detail, detected_at
         ) SELECT ?, 'lease:' || source_key,
           CASE WHEN lease_expires_at <= ? THEN 'expired_lease' ELSE 'resolving_lease' END,
           source_key, CASE WHEN lease_expires_at <= ? THEN 'Expired resolving lease blocks maintenance ownership' ELSE 'Active resolving lease blocks maintenance ownership' END, ?
         FROM music_source_identities WHERE source_key = ? AND state = 'resolving'`
      )
      .bind(generationId, now, now, now, sourceKey),
    bindWinner(
      `INSERT OR IGNORE INTO music_identity_maintenance_findings (
         generation_id, finding_key, category, source_key, detail, detected_at
       ) SELECT ?, 'candidate-overflow:' || ?, 'candidate_overflow', ?,
         'Candidate limit exceeded; canonical mutations require review', ?
       WHERE EXISTS (SELECT 1 FROM overflow)`,
      generationId,
      sourceKey,
      sourceKey,
      now
    ),
    bindWinner(
      `INSERT OR IGNORE INTO music_identity_maintenance_findings (
         generation_id, finding_key, category, source_key, entity_type, entity_id, detail, detected_at
       ) SELECT ?, 'unique:' || winner.source_key, 'collision', winner.source_key,
         winner.entity_type, winner.entity_id, 'Canonical fields are owned by another source key', ?
       FROM winner JOIN music_source_identities i ON i.source_key <> winner.source_key
         AND (i.canonical_url = winner.canonical_url OR
           (winner.external_id IS NOT NULL AND i.platform = winner.platform
             AND i.source_entity_type = winner.source_entity_type AND i.external_id = winner.external_id))`,
      generationId,
      now
    ),
    bindWinner(
      `INSERT OR IGNORE INTO music_identity_maintenance_actions
         (generation_id, action_key, kind, created_at)
       SELECT ?, 'identity:' || winner.source_key, 'identity_created', ? FROM winner
       WHERE NOT EXISTS (SELECT 1 FROM music_source_identities i WHERE
         i.source_key = winner.source_key OR i.canonical_url = winner.canonical_url OR
         (winner.external_id IS NOT NULL AND i.platform = winner.platform
           AND i.source_entity_type = winner.source_entity_type AND i.external_id = winner.external_id))`,
      generationId,
      now
    ),
    bindWinner(
      `INSERT INTO music_source_identities (
         source_key, platform, source_entity_type, external_id, canonical_url, state,
         entity_type, entity_id, resolved_at, created_at, updated_at
       ) SELECT winner.source_key, winner.platform, winner.source_entity_type,
         winner.external_id, winner.canonical_url, 'resolved', winner.entity_type,
         winner.entity_id, ?, ?, ? FROM winner
       WHERE EXISTS (SELECT 1 FROM music_identity_maintenance_actions a
         WHERE a.generation_id = ? AND a.action_key = 'identity:' || winner.source_key)
         AND NOT EXISTS (SELECT 1 FROM music_source_identities i WHERE i.source_key = winner.source_key)`,
      now,
      now,
      now,
      generationId
    ),
    bindWinner(
      `INSERT OR IGNORE INTO music_identity_maintenance_findings (
         generation_id, finding_key, category, source_key, entity_type, entity_id, detail, detected_at
       ) SELECT ?, 'owner:' || e.source_key || ':' || c.entity_type || ':' || c.entity_id,
         'collision', e.source_key, c.entity_type, c.entity_id,
         'Candidate owner differs from the resolved incumbent', ?
       FROM eligible c JOIN music_source_identities e ON e.source_key = c.source_key
         AND e.state = 'resolved'
       WHERE c.entity_type <> e.entity_type OR c.entity_id <> e.entity_id`,
      generationId,
      now
    ),
    bindWinner(
      `INSERT OR IGNORE INTO music_source_identity_conflicts (
         id, source_key, incumbent_entity_type, incumbent_entity_id,
         candidate_entity_type, candidate_entity_id, reason, status, detected_at
       ) SELECT lower(hex(randomblob(16))), e.source_key, e.entity_type, e.entity_id,
         c.entity_type, c.entity_id, 'backfill_duplicate_ownership', 'open', ?
       FROM eligible c JOIN music_source_identities e ON e.source_key = c.source_key
         AND e.state = 'resolved'
       WHERE c.entity_type <> e.entity_type OR c.entity_id <> e.entity_id`,
      now
    ),
    bindWinner(
      `INSERT OR IGNORE INTO music_identity_maintenance_findings (
         generation_id, finding_key, category, source_key, detail, detected_at
       ) SELECT ?, 'alias:' || c.normalized_url, 'collision', c.source_key,
         'Alias is owned by another source key', ? FROM eligible c
       JOIN music_source_aliases a ON a.normalized_url = c.normalized_url
       WHERE a.source_key <> c.source_key`,
      generationId,
      now
    ),
    bindWinner(
      `INSERT OR IGNORE INTO music_identity_maintenance_actions
         (generation_id, action_key, kind, created_at)
       SELECT ?, 'alias-created:' || c.normalized_url, 'alias_created', ? FROM eligible c
       JOIN music_source_identities i ON i.source_key = c.source_key AND i.state = 'resolved'
       WHERE NOT EXISTS (SELECT 1 FROM music_source_aliases a WHERE a.normalized_url = c.normalized_url)`,
      generationId,
      now
    ),
    bindWinner(
      `INSERT OR IGNORE INTO music_source_aliases
         (normalized_url, source_key, first_seen_at, last_seen_at)
       SELECT c.normalized_url, c.source_key, ?, ? FROM eligible c
       WHERE EXISTS (SELECT 1 FROM music_identity_maintenance_actions a
         WHERE a.generation_id = ? AND a.action_key = 'alias-created:' || c.normalized_url)`,
      now,
      now,
      generationId
    ),
    bindWinner(
      `INSERT OR IGNORE INTO music_identity_maintenance_actions
         (generation_id, action_key, kind, created_at)
       SELECT ?, 'alias-touched:' || c.normalized_url, 'alias_touched', ? FROM eligible c
       JOIN music_source_aliases a ON a.normalized_url = c.normalized_url
         AND a.source_key = c.source_key WHERE a.last_seen_at < ?`,
      generationId,
      now,
      now
    ),
    bindWinner(
      `UPDATE music_source_aliases SET last_seen_at = ? WHERE normalized_url IN (
         SELECT c.normalized_url FROM eligible c JOIN music_identity_maintenance_actions a
           ON a.generation_id = ? AND a.action_key = 'alias-touched:' || c.normalized_url
       )`,
      now,
      generationId
    )
  ]
}

const applyPage = (database: D1Database, run: RunRow, batchSize: number, now: number) =>
  Effect.gen(function* () {
    const applyPageSize = Math.min(batchSize, MAX_APPLY_SOURCE_KEYS)
    const sourceKeys = yield* attempt('readSourceKeyPage', async () => {
      const rows = (
        await database
          .prepare(
            `SELECT source_key AS sourceKey FROM music_identity_maintenance_source_keys
             WHERE generation_id = ? AND source_key > ?
             ORDER BY source_key LIMIT ?`
          )
          .bind(run.generationId, run.applyCursorSourceKey, applyPageSize)
          .all<{ readonly sourceKey: string }>()
      ).results
      return rows.map((row) => row.sourceKey)
    })
    if (sourceKeys.length === 0) {
      yield* attempt('completeMaintenanceRun', () =>
        database
          .prepare(
            `UPDATE music_identity_maintenance_runs SET phase = 'complete', active = 0,
               updated_at = ? WHERE generation_id = ?`
          )
          .bind(now, run.generationId)
          .run()
      )
      return
    }
    const statements = sourceKeys.flatMap((sourceKey) =>
      applyStatementsForKey(database, run.generationId, sourceKey, now)
    )
    statements.push(
      database
        .prepare(
          `UPDATE music_identity_maintenance_runs SET apply_cursor_source_key = ?,
             attempted_count = attempted_count + ?, updated_at = ? WHERE generation_id = ?`
        )
        .bind(sourceKeys.at(-1), sourceKeys.length, now, run.generationId)
    )
    yield* attempt('applySourceKeyPage', () => database.batch(statements))
  })

const readSummary = (database: D1Database, generationId: string, batchSize: number) =>
  Effect.gen(function* () {
    const run = yield* readRun(database, generationId)
    if (!run) return yield* Effect.fail(storageError('readSummary', 'Run missing'))
    const actionCounts = yield* attempt(
      'readActionCounts',
      async () =>
        (
          await database
            .prepare(
              `SELECT kind, COUNT(*) AS count FROM music_identity_maintenance_actions
             WHERE generation_id = ? GROUP BY kind`
            )
            .bind(generationId)
            .all<{ readonly kind: string; readonly count: number }>()
        ).results
    )
    const proposed = yield* attempt('readProposedCount', async () => {
      const row = await database
        .prepare(
          `SELECT COUNT(*) AS count
           FROM music_identity_maintenance_source_keys WHERE generation_id = ?`
        )
        .bind(generationId)
        .first<{ readonly count: number }>()
      return row?.count ?? 0
    })
    const findingCount = yield* attempt('readFindingCount', async () => {
      const row = await database
        .prepare(
          'SELECT COUNT(*) AS count FROM music_identity_maintenance_findings WHERE generation_id = ?'
        )
        .bind(generationId)
        .first<{ readonly count: number }>()
      return row?.count ?? 0
    })
    const findingPage = yield* readFindingIssues(database, generationId, '', batchSize)
    const count = (kind: string) => actionCounts.find((row) => row.kind === kind)?.count ?? 0
    return {
      mode: 'backfill' as const,
      dryRun: false,
      generationId,
      phase: run.phase,
      batchSize,
      complete: run.phase === 'complete',
      cursor:
        run.phase === 'scan_links'
          ? `${run.cursorCreatedAt}:${run.cursorId}`
          : run.phase === 'scan_claims'
            ? `${run.claimCursorUpdatedAt}:${run.claimCursorEntityType}:${run.claimCursorCanonicalUrl}`
            : run.applyCursorSourceKey || null,
      scanned: run.scannedCount,
      candidates: run.candidateCount,
      proposed,
      attempted: run.attemptedCount,
      detected: findingCount,
      identitiesCreated: count('identity_created'),
      aliasesCreated: count('alias_created'),
      aliasesTouched: count('alias_touched'),
      invalid: run.invalidCount,
      orphaned: run.orphanCount,
      issues: findingPage.map((row) => row.issue)
    }
  })

const preview = (
  database: D1Database,
  batchSize: number,
  cursor: { readonly createdAt: number; readonly id: string }
) =>
  Effect.gen(function* () {
    const rows = yield* readLinkPage(database, cursor, null, batchSize)
    const issues: IdentityMaintenanceIssue[] = []
    const sources = new Set<string>()
    let candidates = 0
    let invalid = 0
    let orphaned = 0
    for (const row of rows) {
      const entityType = canonicalEntityType(row.entityType)
      if (!entityType) {
        invalid += 1
        issues.push({
          category: 'invalid_source',
          linkId: row.id,
          entityType: row.entityType,
          entityId: row.entityId,
          detail: 'Unsupported canonical music entity type'
        })
        continue
      }
      const parsed = yield* parseSourceResult(row.url, entityType)
      if (parsed._tag === 'invalid' || parsed.source.platform !== row.platform) {
        invalid += 1
        issues.push(
          parsed._tag === 'invalid'
            ? issueForInvalid(row.id, row.entityType, row.entityId, parsed.error)
            : {
                category: 'invalid_source',
                linkId: row.id,
                entityType: row.entityType,
                entityId: row.entityId,
                detail: 'platform_mismatch'
              }
        )
      } else {
        candidates += 1
        sources.add(parsed.source.sourceKey)
      }
      if (row.entityExists !== 1) {
        orphaned += 1
        issues.push({
          category: 'orphaned_link',
          linkId: row.id,
          entityType: row.entityType,
          entityId: row.entityId,
          detail: 'Link references a missing music entity'
        })
      }
    }
    const last = rows.at(-1)
    return {
      mode: 'backfill' as const,
      dryRun: true,
      generationId: null,
      phase: 'preview' as const,
      batchSize,
      complete: rows.length < batchSize,
      cursor: last ? `${last.createdAt}:${last.id}` : null,
      scanned: rows.length,
      candidates,
      proposed: sources.size,
      attempted: 0,
      detected: issues.length,
      identitiesCreated: 0,
      aliasesCreated: 0,
      aliasesTouched: 0,
      invalid,
      orphaned,
      issues
    }
  })

export const runIdentityBackfillBatch = (
  db: DatabaseClient,
  options: IdentityBackfillOptions = {}
): Effect.Effect<IdentityBackfillSummary, MusicIdentityStorageError> =>
  Effect.gen(function* () {
    const batchSize = yield* validatedBatchSize(options.batchSize)
    const database = db.$client
    const now = (options.now ?? new Date()).getTime()
    if (!options.apply) {
      return yield* preview(database, batchSize, options.cursor ?? { createdAt: -1, id: '' })
    }
    if (options.cursor) {
      return yield* Effect.fail(
        new MusicIdentityStorageError({
          operation: 'validateCursor',
          message: 'Applied runs use only their durable generation cursor'
        })
      )
    }
    let run = yield* readRun(database, options.generationId)
    if (!run) {
      if (options.generationId) {
        return yield* Effect.fail(
          new MusicIdentityStorageError({
            operation: 'validateGeneration',
            message: 'The requested maintenance generation does not exist'
          })
        )
      }
      run = yield* initializeRun(database, now)
    }
    if (run.phase === 'scan_links') yield* scanLinks(database, run, batchSize, now)
    else if (run.phase === 'scan_claims') yield* scanClaims(database, run, batchSize, now)
    else if (run.phase === 'apply') yield* applyPage(database, run, batchSize, now)
    return yield* readSummary(database, run.generationId, batchSize)
  }).pipe(Effect.withSpan('musicIdentity.backfillBatch'))

const readFindingIssues = (
  database: D1Database,
  generationId: string,
  cursor: string,
  batchSize: number
) =>
  attempt('readMaintenanceFindings', async () => {
    const rows = (
      await database
        .prepare(
          `SELECT finding_key AS findingKey, category, source_key AS sourceKey,
             origin_key AS originKey, entity_type AS entityType, entity_id AS entityId, detail
           FROM music_identity_maintenance_findings
           WHERE generation_id = ? AND finding_key > ? ORDER BY finding_key LIMIT ?`
        )
        .bind(generationId, cursor, batchSize)
        .all<{
          readonly findingKey: string
          readonly category: IdentityMaintenanceIssue['category']
          readonly sourceKey: string | null
          readonly originKey: string | null
          readonly entityType: string | null
          readonly entityId: string | null
          readonly detail: string
        }>()
    ).results
    return rows.map((row) => ({
      key: row.findingKey,
      issue: {
        category: row.category,
        sourceKey: row.sourceKey ?? undefined,
        linkId: row.originKey ?? undefined,
        entityType: row.entityType ?? undefined,
        entityId: row.entityId ?? undefined,
        detail: row.detail
      }
    }))
  })

type AuditPageRow = {
  readonly key: string
  readonly issue?: IdentityMaintenanceIssue
}

const auditSimplePage = (
  database: D1Database,
  phase: Exclude<IdentityAuditPhase, 'links' | 'findings'>,
  cursor: string,
  batchSize: number,
  now: number
): Effect.Effect<ReadonlyArray<AuditPageRow>, MusicIdentityStorageError> =>
  attempt(`audit.${phase}`, async () => {
    if (phase === 'identities') {
      const rows = (
        await database
          .prepare(
            `SELECT source_key AS sourceKey, entity_type AS entityType, entity_id AS entityId,
               ${entityExistsSql('i')} AS entityExists
             FROM music_source_identities i WHERE i.source_key > ? AND i.state = 'resolved'
             ORDER BY i.source_key LIMIT ?`
          )
          .bind(cursor, batchSize)
          .all<{
            readonly sourceKey: string
            readonly entityType: string
            readonly entityId: string
            readonly entityExists: number
          }>()
      ).results
      return rows.map((row) => ({
        key: row.sourceKey,
        issue:
          row.entityExists === 1
            ? undefined
            : {
                category: 'orphaned_identity' as const,
                sourceKey: row.sourceKey,
                entityType: row.entityType,
                entityId: row.entityId,
                detail: 'Resolved identity references a missing music entity'
              }
      }))
    }
    if (phase === 'aliases') {
      const rows = (
        await database
          .prepare(
            `SELECT a.normalized_url AS normalizedUrl, a.source_key AS sourceKey,
               i.source_key IS NOT NULL AS identityExists
             FROM music_source_aliases a LEFT JOIN music_source_identities i
               ON i.source_key = a.source_key
             WHERE a.normalized_url > ? ORDER BY a.normalized_url LIMIT ?`
          )
          .bind(cursor, batchSize)
          .all<{
            readonly normalizedUrl: string
            readonly sourceKey: string
            readonly identityExists: number
          }>()
      ).results
      return rows.map((row) => ({
        key: row.normalizedUrl,
        issue:
          row.identityExists === 1
            ? undefined
            : {
                category: 'orphaned_alias' as const,
                sourceKey: row.sourceKey,
                detail: 'Alias references a missing identity'
              }
      }))
    }
    if (phase === 'leases') {
      const rows = (
        await database
          .prepare(
            `SELECT source_key AS sourceKey, lease_expires_at AS leaseExpiresAt
             FROM music_source_identities WHERE state = 'resolving' AND source_key > ?
             ORDER BY source_key LIMIT ?`
          )
          .bind(cursor, batchSize)
          .all<{ readonly sourceKey: string; readonly leaseExpiresAt: number }>()
      ).results
      return rows.map((row) => ({
        key: row.sourceKey,
        issue: {
          category:
            row.leaseExpiresAt <= now ? ('expired_lease' as const) : ('resolving_lease' as const),
          sourceKey: row.sourceKey,
          detail:
            row.leaseExpiresAt <= now
              ? 'Expired resolving lease requires recovery'
              : 'Active resolving lease is still in progress'
        }
      }))
    }
    const separator = cursor.indexOf(':')
    const detectedAt = separator < 0 ? -1 : Number(cursor.slice(0, separator))
    const id = separator < 0 ? '' : cursor.slice(separator + 1)
    const rows = (
      await database
        .prepare(
          `SELECT detected_at AS detectedAt, id, source_key AS sourceKey,
             candidate_entity_type AS entityType, candidate_entity_id AS entityId
           FROM music_source_identity_conflicts
           WHERE status = 'open' AND
             (detected_at > ? OR (detected_at = ? AND id > ?))
           ORDER BY detected_at, id LIMIT ?`
        )
        .bind(detectedAt, detectedAt, id, batchSize)
        .all<{
          readonly detectedAt: number
          readonly id: string
          readonly sourceKey: string
          readonly entityType: string
          readonly entityId: string
        }>()
    ).results
    return rows.map((row) => ({
      key: `${String(row.detectedAt).padStart(20, '0')}:${row.id}`,
      issue: {
        category: 'collision' as const,
        sourceKey: row.sourceKey,
        entityType: row.entityType,
        entityId: row.entityId,
        detail: 'Open canonical identity conflict'
      }
    }))
  })

export const auditMusicIdentities = (
  db: DatabaseClient,
  options: IdentityAuditOptions = {}
): Effect.Effect<IdentityAuditSummary, MusicIdentityStorageError> =>
  Effect.gen(function* () {
    const batchSize = yield* validatedBatchSize(options.batchSize)
    const database = db.$client
    const phase = options.phase ?? 'links'
    const cursor = options.cursor ?? ''
    if (phase === 'findings') {
      const run = yield* readRun(database, options.generationId)
      if (!run) {
        return {
          mode: 'audit' as const,
          phase,
          batchSize,
          complete: true,
          cursor: null,
          scanned: 0,
          detected: 0,
          issues: []
        }
      }
      const rows = yield* readFindingIssues(database, run.generationId, cursor, batchSize)
      return {
        mode: 'audit' as const,
        phase,
        batchSize,
        complete: rows.length < batchSize,
        cursor: rows.at(-1)?.key ?? null,
        scanned: rows.length,
        detected: rows.length,
        issues: rows.map((row) => row.issue)
      }
    }
    if (phase === 'links') {
      const separator = cursor.indexOf(':')
      const createdAt = separator < 0 ? -1 : Number(cursor.slice(0, separator))
      const id = separator < 0 ? '' : cursor.slice(separator + 1)
      const rows = yield* readLinkPage(database, { createdAt, id }, null, batchSize)
      const issues: IdentityMaintenanceIssue[] = []
      for (const row of rows) {
        const entityType = canonicalEntityType(row.entityType)
        if (!entityType) {
          issues.push({
            category: 'invalid_source',
            linkId: row.id,
            entityType: row.entityType,
            entityId: row.entityId,
            detail: 'Unsupported canonical music entity type'
          })
        } else {
          const parsed = yield* parseSourceResult(row.url, entityType)
          if (parsed._tag === 'invalid' || parsed.source.platform !== row.platform)
            issues.push(
              parsed._tag === 'invalid'
                ? issueForInvalid(row.id, row.entityType, row.entityId, parsed.error)
                : {
                    category: 'invalid_source',
                    linkId: row.id,
                    entityType: row.entityType,
                    entityId: row.entityId,
                    detail: 'platform_mismatch'
                  }
            )
        }
        if (row.entityExists !== 1)
          issues.push({
            category: 'orphaned_link',
            linkId: row.id,
            entityType: row.entityType,
            entityId: row.entityId,
            detail: 'Link references a missing music entity'
          })
      }
      const last = rows.at(-1)
      return {
        mode: 'audit' as const,
        phase,
        batchSize,
        complete: rows.length < batchSize,
        cursor: last ? `${last.createdAt}:${last.id}` : null,
        scanned: rows.length,
        detected: issues.length,
        issues
      }
    }
    const rows = yield* auditSimplePage(
      database,
      phase,
      cursor,
      batchSize,
      (options.now ?? new Date()).getTime()
    )
    const issues = rows.flatMap((row) => (row.issue ? [row.issue] : []))
    return {
      mode: 'audit' as const,
      phase,
      batchSize,
      complete: rows.length < batchSize,
      cursor: rows.at(-1)?.key ?? null,
      scanned: rows.length,
      detected: issues.length,
      issues
    }
  }).pipe(Effect.withSpan('musicIdentity.audit'))
