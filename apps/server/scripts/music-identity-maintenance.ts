import { Effect } from 'effect'
import { Database, DatabaseLayer } from '../src/db/layer'
import {
  auditMusicIdentities,
  runIdentityBackfillBatch
} from '../src/services/canonical-music-identity/identity-maintenance'
import { createRemoteD1, remoteD1OptionsFromEnv } from './remote-d1'

const PRODUCTION_CONFIRMATION = 'I_UNDERSTAND_IDENTITY_MAINTENANCE_PRODUCTION'

const valueFor = (name: string) => {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

const hasFlag = (name: string) => process.argv.includes(`--${name}`)

const mode = process.argv[2]
const environment = valueFor('environment')
const batchSizeValue = valueFor('batch-size')
const batchSize = batchSizeValue === undefined ? undefined : Number(batchSizeValue)
const apply = hasFlag('apply')
const confirmation = valueFor('confirm-production')
const cursorCreatedAtValue = valueFor('cursor-created-at')
const cursorId = valueFor('cursor-id')
const generationId = valueFor('generation-id')
const auditPhase = valueFor('phase')
const auditCursor = valueFor('cursor')
const cursor =
  cursorCreatedAtValue !== undefined && cursorId !== undefined
    ? { createdAt: Number(cursorCreatedAtValue), id: cursorId }
    : undefined

const validateInvocation = () => {
  if (mode !== 'backfill' && mode !== 'audit') {
    throw new Error('Mode must be backfill or audit')
  }
  if (!environment || !['development', 'staging', 'production'].includes(environment)) {
    throw new Error('--environment=development|staging|production is required')
  }
  if (process.env.D1_ENVIRONMENT !== environment) {
    throw new Error('D1_ENVIRONMENT must exactly match --environment')
  }
  const databaseIdVariable = `D1_${environment.toUpperCase()}_DATABASE_ID`
  const expectedDatabaseId = process.env[databaseIdVariable]
  if (!expectedDatabaseId) {
    throw new Error(`${databaseIdVariable} is required`)
  }
  if (process.env.D1_DATABASE_ID !== expectedDatabaseId) {
    throw new Error(`D1_DATABASE_ID must exactly match ${databaseIdVariable}`)
  }
  const productionDatabaseId = process.env.D1_PRODUCTION_DATABASE_ID
  if (!productionDatabaseId) {
    throw new Error('D1_PRODUCTION_DATABASE_ID is required')
  }
  if (environment !== 'production' && process.env.D1_DATABASE_ID === productionDatabaseId) {
    throw new Error('The production D1 database cannot be selected as a non-production environment')
  }
  if (mode === 'audit' && apply) {
    throw new Error('--apply is only valid for backfill mode')
  }
  if (mode === 'audit' && cursor) {
    throw new Error('Backfill cursor flags are only valid for backfill mode')
  }
  if (mode === 'backfill' && (auditPhase || auditCursor)) {
    throw new Error('--phase and --cursor are only valid for audit mode')
  }
  if (
    auditPhase &&
    !['links', 'identities', 'aliases', 'conflicts', 'leases', 'findings'].includes(auditPhase)
  ) {
    throw new Error('--phase must be links, identities, aliases, conflicts, leases, or findings')
  }
  if ((cursorCreatedAtValue === undefined) !== (cursorId === undefined)) {
    throw new Error('--cursor-created-at and --cursor-id must be supplied together')
  }
  if (apply && cursor) {
    throw new Error('Applied runs always use the durable checkpoint; remove cursor flags')
  }
  if (environment === 'production' && confirmation !== PRODUCTION_CONFIRMATION) {
    throw new Error(`Production requires --confirm-production=${PRODUCTION_CONFIRMATION}`)
  }
}

const program = Effect.gen(function* () {
  validateInvocation()
  const db = yield* Database
  if (mode === 'audit') {
    return yield* auditMusicIdentities(db, {
      batchSize,
      phase:
        auditPhase === 'links' ||
        auditPhase === 'identities' ||
        auditPhase === 'aliases' ||
        auditPhase === 'conflicts' ||
        auditPhase === 'leases' ||
        auditPhase === 'findings'
          ? auditPhase
          : undefined,
      cursor: auditCursor,
      generationId
    })
  }
  return yield* runIdentityBackfillBatch(db, { apply, batchSize, cursor, generationId })
})

Effect.runPromise(
  program.pipe(Effect.provide(DatabaseLayer(createRemoteD1(remoteD1OptionsFromEnv()))))
)
  .then((summary) => {
    console.log(JSON.stringify(summary))
  })
  .catch((error: unknown) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    process.exitCode = 1
  })
