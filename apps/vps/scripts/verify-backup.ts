#!/usr/bin/env bun

import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { BunRuntime } from '@effect/platform-bun'
import { Console, Effect } from 'effect'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { Resource } from 'sst'

const PG_PASSWORD = 'verify_pass'
const PG_USER = 'verify_user'
const PG_DB = 'verify_db'
const CONTAINER_NAME = `gbfm-backup-verify-${Date.now()}`

function getBucketName(): string {
  try {
    return (
      (Resource as unknown as Record<string, { name?: string }>).DatabaseBackups?.name ||
      process.env.DATABASE_BACKUP_BUCKET ||
      ''
    )
  } catch {
    return process.env.DATABASE_BACKUP_BUCKET || ''
  }
}

const spawn = (cmd: string[], opts?: { env?: Record<string, string> }) =>
  Effect.tryPromise({
    try: async () => {
      const proc = Bun.spawn(cmd, {
        stdout: 'pipe',
        stderr: 'pipe',
        env: opts?.env ? { ...process.env, ...opts.env } : process.env
      })
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited
      ])
      return { stdout, stderr, exitCode }
    },
    catch: (e) => new Error(`spawn failed (${cmd[0]}): ${e}`)
  })

const downloadLatestBackup = Effect.gen(function* () {
  const bucketName = getBucketName()
  if (!bucketName) return yield* Effect.fail(new Error('DATABASE_BACKUP_BUCKET not configured'))

  yield* Console.log(`📦 Fetching backup list from: ${bucketName}`)

  const s3 = new S3Client({})

  const list = yield* Effect.tryPromise({
    try: () => s3.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 100 })),
    catch: (e) => new Error(`S3 list failed: ${e}`)
  })

  if (!list.Contents?.length) return yield* Effect.fail(new Error('No backups in S3'))

  const latest = list.Contents.filter((o) => o.Key?.endsWith('.sql')).toSorted(
    (a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0)
  )[0]

  if (!latest?.Key) return yield* Effect.fail(new Error('No .sql backup found'))

  yield* Console.log(
    `✅ Latest: ${latest.Key} (${((latest.Size ?? 0) / 1024 / 1024).toFixed(2)} MB)`
  )
  yield* Console.log(`   Created: ${latest.LastModified?.toISOString()}`)

  const get = yield* Effect.tryPromise({
    try: () => s3.send(new GetObjectCommand({ Bucket: bucketName, Key: latest.Key! })),
    catch: (e) => new Error(`S3 get failed: ${e}`)
  })

  const content = yield* Effect.tryPromise({
    try: () => get.Body!.transformToString(),
    catch: (e) => new Error(`Failed to read S3 body: ${e}`)
  })

  const tempPath = path.join(process.cwd(), '.tmp', `verify-${Date.now()}.sql`)
  yield* Effect.tryPromise({
    try: () => Bun.write(tempPath, content),
    catch: (e) => new Error(`Failed to write temp file: ${e}`)
  })

  yield* Console.log(`💾 Downloaded to: ${tempPath}`)
  return tempPath
})

const startContainer = Effect.gen(function* () {
  yield* Console.log('\n🐳 Starting Postgres 18 container...')

  const result = yield* spawn([
    'docker',
    'run',
    '--rm',
    '-d',
    '--name',
    CONTAINER_NAME,
    '-e',
    `POSTGRES_PASSWORD=${PG_PASSWORD}`,
    '-e',
    `POSTGRES_USER=${PG_USER}`,
    '-e',
    `POSTGRES_DB=${PG_DB}`,
    '-p',
    '0:5432',
    'postgres:18-alpine'
  ])

  if (result.exitCode !== 0) {
    return yield* Effect.fail(new Error(`docker run failed: ${result.stderr}`))
  }

  const containerId = result.stdout.trim()
  yield* Console.log(`   Container ID: ${containerId.slice(0, 12)}`)

  yield* Console.log('   Waiting for Postgres to be ready...')

  let ready = false
  for (let i = 0; i < 30; i++) {
    const health = yield* spawn([
      'docker',
      'exec',
      CONTAINER_NAME,
      'pg_isready',
      '-U',
      PG_USER,
      '-d',
      PG_DB
    ])
    if (health.exitCode === 0) {
      ready = true
      break
    }
    yield* Effect.sleep('1 second')
    yield* Console.log(`   Waiting... (${i + 1}s)`)
  }

  if (!ready) return yield* Effect.fail(new Error('Postgres container did not become ready in 30s'))

  const portResult = yield* spawn([
    'docker',
    'inspect',
    CONTAINER_NAME,
    '--format',
    '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}'
  ])

  const port = portResult.stdout.trim()
  yield* Console.log(`✅ Container ready on port ${port}`)

  return { port, containerId }
})

const stopContainer = Effect.gen(function* () {
  yield* Console.log('🧹 Stopping container...')
  yield* spawn(['docker', 'stop', CONTAINER_NAME])
  yield* Console.log('   Container stopped')
})

const psql = (args: string[], port: string) =>
  spawn(['psql', ...args], {
    env: {
      PGPASSWORD: PG_PASSWORD,
      PGUSER: PG_USER,
      PGHOST: '127.0.0.1',
      PGDATABASE: PG_DB,
      PGPORT: port
    }
  })

const sanityChecks = (port: string) =>
  Effect.gen(function* () {
    yield* Console.log('\n🔍 Running sanity checks...')

    const tables = [
      { name: 'audio', label: 'Mixes / audio' },
      { name: 'shows', label: 'Shows' },
      { name: 'posts', label: 'Posts' },
      { name: 'labels', label: 'Labels' },
      { name: 'newsletter_subscribers', label: 'Newsletter subscribers' },
      { name: 'releases', label: 'Releases' }
    ]

    for (const { name, label } of tables) {
      const result = yield* psql(['-t', '-c', `SELECT COUNT(*) FROM ${name};`], port)
      if (result.exitCode !== 0) {
        yield* Console.log(`   ⚠️  ${label}: query failed — ${result.stderr.trim()}`)
      } else {
        yield* Console.log(`   ${label}: ${result.stdout.trim()} rows`)
      }
    }
  })

const restoreAndVerify = (filePath: string) =>
  Effect.gen(function* () {
    const { port } = yield* startContainer

    yield* Effect.addFinalizer(() => stopContainer.pipe(Effect.orDie))

    yield* Console.log('📦 Restoring backup...')
    const restore = yield* psql(['-f', filePath], port)

    if (restore.exitCode !== 0) {
      return yield* Effect.fail(
        new Error(`psql restore failed (exit ${restore.exitCode}): ${restore.stderr}`)
      )
    }

    const warnings = restore.stderr
      .split('\n')
      .filter(
        (l) => l && !l.includes('NOTICE') && !l.includes('already exists') && !l.includes('hypopg')
      )
    if (warnings.length > 0) {
      yield* Console.log(`⚠️  Warnings:\n${warnings.join('\n')}`)
    }

    yield* Console.log('✅ Restore complete')

    yield* sanityChecks(port)

    yield* Console.log('\n🎉 Backup verified successfully')
  })

const program = Effect.gen(function* () {
  const filePath = yield* downloadLatestBackup

  yield* Effect.addFinalizer(() =>
    Effect.tryPromise({
      try: () => unlink(filePath),
      catch: () => new Error('Temp file cleanup failed')
    }).pipe(
      Effect.tap(() => Console.log(`🧹 Cleaned up temp file`)),
      Effect.orDie
    )
  )

  yield* Effect.scoped(restoreAndVerify(filePath))
})

BunRuntime.runMain(
  Effect.scoped(program).pipe(
    Effect.tapError((e) => Console.error(`❌ Verification failed: ${(e as Error).message}`))
  )
)
