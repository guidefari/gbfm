import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { Database } from '@/db/layer'
import { audioCreators } from '@/db/audio.schema'
import { musicLabelCreatorsTable } from '@/db/music-entity.schema'
import { postCreators } from '@/db/post.schema'
import { showCreators } from '@/db/show.schema'
import { DatabaseError, getErrorMessage, UnauthorizedError } from '@/errors'

type CreatorTableType = 'show' | 'audio' | 'label' | 'post'

export function checkCreatorAuthorship(
  db: Database['Service'],
  tableType: CreatorTableType,
  resourceId: string,
  userId: string
) {
  return Effect.gen(function* () {
    const table =
      tableType === 'show'
        ? showCreators
        : tableType === 'audio'
          ? audioCreators
          : tableType === 'label'
            ? musicLabelCreatorsTable
            : postCreators

    const idColumn =
      tableType === 'show'
        ? showCreators.showId
        : tableType === 'audio'
          ? audioCreators.audioId
          : tableType === 'label'
            ? musicLabelCreatorsTable.labelId
            : postCreators.postId

    const creatorColumn =
      tableType === 'show'
        ? showCreators.creatorId
        : tableType === 'audio'
          ? audioCreators.creatorId
          : tableType === 'label'
            ? musicLabelCreatorsTable.creatorId
            : postCreators.creatorId

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
          table: `${tableType}_creators`
        })
    })

    return authorship.length > 0
  })
}

export function requireCreatorOrAdmin(
  db: Database['Service'],
  tableType: CreatorTableType,
  resourceId: string,
  userId: string,
  userRole: string
) {
  return Effect.gen(function* () {
    if (userRole === 'admin') {
      return
    }

    const isCreator = yield* checkCreatorAuthorship(db, tableType, resourceId, userId)

    if (!isCreator) {
      return yield* new UnauthorizedError({
        message: 'Not authorized to modify this resource',
        userId
      })
    }
  })
}

export function requireCreator(
  db: Database['Service'],
  tableType: CreatorTableType,
  resourceId: string,
  userId: string
) {
  return Effect.gen(function* () {
    const isCreator = yield* checkCreatorAuthorship(db, tableType, resourceId, userId)

    if (!isCreator) {
      return yield* new UnauthorizedError({
        message: 'Not authorized to modify this resource',
        userId
      })
    }
  })
}
