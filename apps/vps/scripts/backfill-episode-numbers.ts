#!/usr/bin/env bun

import { and, eq, inArray, isNull } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import { pool } from '@/db'
import { Database, DatabaseLayer } from '@/db/layer'
import { audioTable } from '@/db/audio.schema'
import { DatabaseError } from '@/errors'

interface EpisodeAssignment {
  readonly slug: string
  readonly episodeNumber: number
}

const assignments: readonly EpisodeAssignment[] = [
  { slug: 'gb63', episodeNumber: 63 },
  { slug: 'gb62', episodeNumber: 62 },
  { slug: 'gb61', episodeNumber: 61 },
  { slug: 'gb60', episodeNumber: 60 },
  { slug: 'gb59', episodeNumber: 59 },
  { slug: 'gb58', episodeNumber: 58 },
  { slug: 'gb57', episodeNumber: 57 },
  { slug: 'gb55', episodeNumber: 55 },
  { slug: 'gb53', episodeNumber: 53 },
  { slug: 'gb52', episodeNumber: 52 },
  { slug: 'gb51', episodeNumber: 51 },
  { slug: 'gb50', episodeNumber: 50 },
  { slug: 'gb49', episodeNumber: 49 },
  { slug: 'gb48', episodeNumber: 48 },
  { slug: 'gb47', episodeNumber: 47 },
  { slug: 'gb46', episodeNumber: 46 },
  { slug: 'gb45', episodeNumber: 45 },
  { slug: 'gb43', episodeNumber: 43 },
  { slug: 'gb42', episodeNumber: 42 },
  { slug: 'gb41', episodeNumber: 41 },
  { slug: 'gb35', episodeNumber: 35 },
  { slug: 'gb33', episodeNumber: 33 },
  { slug: 'gb21', episodeNumber: 21 }
]

class MappingError extends Data.TaggedError('MappingError')<{
  readonly message: string
}> {}

class VerificationError extends Data.TaggedError('VerificationError')<{
  readonly message: string
}> {}

type Verdict = 'pending' | 'satisfied' | 'conflict' | 'missing' | 'mismatch'

interface Plan {
  readonly assignment: EpisodeAssignment
  readonly verdict: Verdict
  readonly detail: string
}

const titleMatchesSlug = (title: string, assignment: EpisodeAssignment): boolean => {
  const match = title.match(/gb#\s*(\d+)/i)
  if (!match?.[1]) return false
  return Number.parseInt(match[1], 10) === assignment.episodeNumber
}

const query = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new DatabaseError({
        message: cause instanceof Error ? cause.message : String(cause),
        operation,
        table: 'audio'
      })
  })

const validateMapping = Effect.gen(function* () {
  const slugs = new Set(assignments.map((a) => a.slug))
  if (slugs.size !== assignments.length) {
    return yield* new MappingError({ message: 'duplicate slug in assignments' })
  }

  const numbers = new Set(assignments.map((a) => a.episodeNumber))
  if (numbers.size !== assignments.length) {
    return yield* new MappingError({ message: 'duplicate episodeNumber in assignments' })
  }

  const invalid = assignments.filter(
    (a) => !Number.isInteger(a.episodeNumber) || a.episodeNumber <= 0
  )
  if (invalid.length > 0) {
    return yield* new MappingError({
      message: `episodeNumber must be a positive integer: ${invalid.map((a) => a.slug).join(', ')}`
    })
  }

  return assignments
})

const buildPlan = Effect.gen(function* () {
  const db = yield* Database
  yield* validateMapping

  const rows = yield* query('backfill.read', () =>
    db
      .select({
        id: audioTable.id,
        slug: audioTable.slug,
        title: audioTable.title,
        showId: audioTable.showId,
        episodeNumber: audioTable.episodeNumber
      })
      .from(audioTable)
      .where(
        and(
          eq(audioTable.type, 'mix'),
          inArray(
            audioTable.slug,
            assignments.map((a) => a.slug)
          )
        )
      )
  )

  const bySlug = new Map(rows.map((r) => [r.slug, r]))

  const taken = yield* query('backfill.readTaken', () =>
    db
      .select({
        id: audioTable.id,
        slug: audioTable.slug,
        episodeNumber: audioTable.episodeNumber,
        showId: audioTable.showId
      })
      .from(audioTable)
      .where(eq(audioTable.type, 'mix'))
  )

  const plannedSlugs = new Set(assignments.map((a) => a.slug))

  const plans: Plan[] = assignments.map((assignment) => {
    const row = bySlug.get(assignment.slug)

    if (!row) {
      return { assignment, verdict: 'missing', detail: 'slug not found in audio table' }
    }

    if (!titleMatchesSlug(row.title, assignment)) {
      return {
        assignment,
        verdict: 'mismatch',
        detail: `title ${row.title} does not reference episode ${assignment.episodeNumber}`
      }
    }

    if (row.episodeNumber !== null) {
      return row.episodeNumber === assignment.episodeNumber
        ? { assignment, verdict: 'satisfied', detail: 'already set to the target value' }
        : {
            assignment,
            verdict: 'conflict',
            detail: `already set to ${row.episodeNumber}`
          }
    }

    const holder = taken.find(
      (t) =>
        t.showId === row.showId &&
        t.episodeNumber === assignment.episodeNumber &&
        !plannedSlugs.has(t.slug)
    )

    if (holder) {
      return {
        assignment,
        verdict: 'conflict',
        detail: `episode ${assignment.episodeNumber} already used by ${holder.slug} in this show`
      }
    }

    return { assignment, verdict: 'pending', detail: 'will set' }
  })

  return plans
})

const reportPlan = (plans: readonly Plan[]) =>
  Effect.gen(function* () {
    const counts = {
      pending: plans.filter((p) => p.verdict === 'pending').length,
      satisfied: plans.filter((p) => p.verdict === 'satisfied').length,
      conflict: plans.filter((p) => p.verdict === 'conflict').length,
      missing: plans.filter((p) => p.verdict === 'missing').length,
      mismatch: plans.filter((p) => p.verdict === 'mismatch').length
    }

    yield* Effect.log(`mapped episodes:  ${assignments.length}`)
    yield* Effect.log(`will write:       ${counts.pending}`)
    yield* Effect.log(`already correct:  ${counts.satisfied}`)
    yield* Effect.log(`conflicts:        ${counts.conflict}`)
    yield* Effect.log(`missing ids:      ${counts.missing}`)
    yield* Effect.log(`row mismatches:   ${counts.mismatch}`)

    for (const plan of plans) {
      if (plan.verdict === 'satisfied') continue
      const number = String(plan.assignment.episodeNumber).padStart(3)
      yield* Effect.log(
        `  ${plan.verdict.padEnd(9)} ${number}  ${plan.assignment.slug.padEnd(8)} ${plan.detail}`
      )
    }

    return counts
  })

const applyPlan = (plans: readonly Plan[]) =>
  Effect.gen(function* () {
    const db = yield* Database
    const pending = plans.filter((p) => p.verdict === 'pending')

    const results = yield* Effect.forEach(
      pending,
      (plan) =>
        query('backfill.update', () =>
          db
            .update(audioTable)
            .set({ episodeNumber: plan.assignment.episodeNumber })
            .where(
              and(
                eq(audioTable.type, 'mix'),
                eq(audioTable.slug, plan.assignment.slug),
                isNull(audioTable.episodeNumber)
              )
            )
            .returning({ id: audioTable.id })
        ).pipe(Effect.map((rows) => ({ plan, written: rows.length > 0 }))),
      { concurrency: 1 }
    )

    const written = results.filter((r) => r.written)
    const skipped = results.filter((r) => !r.written)

    for (const result of written) {
      yield* Effect.log(
        `  set ${String(result.plan.assignment.episodeNumber).padStart(3)}  ${result.plan.assignment.slug}`
      )
    }

    for (const result of skipped) {
      yield* Effect.logWarning(
        `  no-op ${result.plan.assignment.slug}: episodeNumber was set concurrently`
      )
    }

    return { written: written.length, skipped: skipped.length }
  })

const verify = Effect.gen(function* () {
  const db = yield* Database
  const rows = yield* query('backfill.verify', () =>
    db
      .select({ slug: audioTable.slug, episodeNumber: audioTable.episodeNumber })
      .from(audioTable)
      .where(
        and(
          eq(audioTable.type, 'mix'),
          inArray(
            audioTable.slug,
            assignments.map((a) => a.slug)
          )
        )
      )
  )

  const bySlug = new Map(rows.map((r) => [r.slug, r]))
  const wrong = assignments.filter((a) => bySlug.get(a.slug)?.episodeNumber !== a.episodeNumber)

  if (wrong.length > 0) {
    return yield* new VerificationError({
      message: `episodes not at target value: ${wrong.map((a) => a.slug).join(', ')}`
    })
  }

  yield* Effect.log(`verified ${assignments.length} episodes at their mapped numbers`)
})

const program = Effect.gen(function* () {
  const apply = process.argv.includes('--apply')

  const plans = yield* buildPlan
  const counts = yield* reportPlan(plans)

  if (counts.missing > 0 || counts.mismatch > 0 || counts.conflict > 0) {
    return yield* new MappingError({
      message: 'refusing to write: mapping does not match the database'
    })
  }

  if (!apply) {
    yield* Effect.log('dry run. no rows written. pass --apply to write.')
    return
  }

  const result = yield* applyPlan(plans)
  yield* Effect.log(`wrote ${result.written}, no-op ${result.skipped}`)
  yield* verify
})

const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(DatabaseLayer(pool))))

if (exit._tag === 'Failure') {
  console.error(exit.cause)
  process.exit(1)
}

process.exit(0)
