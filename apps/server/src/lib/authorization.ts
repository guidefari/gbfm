import { and, eq } from 'drizzle-orm'
import { Effect, Match } from 'effect'

import { audioCreators } from '@/db/audio.schema'
import { Database } from '@/db/layer'
import { musicLabelCreatorsTable } from '@/db/music-entity.schema'
import { postCreators } from '@/db/post.schema'
import { showCreators } from '@/db/show.schema'
import { DatabaseError, getErrorMessage, UnauthorizedError } from '@/errors'

type CreatorTableType = 'show' | 'audio' | 'label' | 'post'

export function checkCreatorAuthorship(
  tableType: CreatorTableType,
  resourceId: string,
  userId: string,
) {
  return Effect.gen(function* () {
    const db = yield* Database

    const table = Match.value(tableType).pipe(
      Match.when('show', () => showCreators),
      Match.when('audio', () => audioCreators),
      Match.when('label', () => musicLabelCreatorsTable),
      Match.when('post', () => postCreators),
      Match.exhaustive,
    )

    const idColumn = Match.value(tableType).pipe(
      Match.when('show', () => showCreators.showId),
      Match.when('audio', () => audioCreators.audioId),
      Match.when('label', () => musicLabelCreatorsTable.labelId),
      Match.when('post', () => postCreators.postId),
      Match.exhaustive,
    )

    const creatorColumn = Match.value(tableType).pipe(
      Match.when('show', () => showCreators.creatorId),
      Match.when('audio', () => audioCreators.creatorId),
      Match.when('label', () => musicLabelCreatorsTable.creatorId),
      Match.when('post', () => postCreators.creatorId),
      Match.exhaustive,
    )

    const authorship = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(table)
          .where(and(eq(idColumn, resourceId), eq(creatorColumn, userId)))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check authorship: ${getErrorMessage(error)}`,
          operation: 'select',
          table: `${tableType}_creators`,
        }),
    })

    return authorship.length > 0
  })
}

export function requireCreatorOrAdmin(
  tableType: CreatorTableType,
  resourceId: string,
  userId: string,
  userRole: string,
) {
  return Effect.gen(function* () {
    if (userRole === 'admin') {
      return undefined
    }

    const isCreator = yield* checkCreatorAuthorship(tableType, resourceId, userId)

    if (!isCreator) {
      return yield* new UnauthorizedError({
        message: 'Not authorized to modify this resource',
        userId,
      })
    }

    return undefined
  })
}

export function requireCreator(tableType: CreatorTableType, resourceId: string, userId: string) {
  return Effect.gen(function* () {
    const isCreator = yield* checkCreatorAuthorship(tableType, resourceId, userId)

    if (!isCreator) {
      return yield* new UnauthorizedError({
        message: 'Not authorized to modify this resource',
        userId,
      })
    }

    return undefined
  })
}
