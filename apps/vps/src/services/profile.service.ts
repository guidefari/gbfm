import { and, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { audioCreators, audioTable } from '@/db/audio.schema'
import { user as userTable } from '@/db/auth.schema'
import { showCreators, showsTable } from '@/db/show.schema'
import { DatabaseError, NotFoundError } from '@/errors'

export type PublicProfile = {
  id: string
  name: string
  username: string | null
  image: string | null
  createdAt: Date
  content: {
    mixes: Array<{
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
      type: 'mix' | 'track' | 'misc' | 'radio_show'
    }>
    shows: Array<{
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
    }>
  }
}

export interface ProfileService {
  readonly getPublicProfile: (
    username: string
  ) => Effect.Effect<PublicProfile, DatabaseError | NotFoundError>
}

export const ProfileService =
  Context.GenericTag<ProfileService>('ProfileService')

const getPublicProfileEffect = (username: string) =>
  Effect.gen(function* () {
    const userRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: userTable.id,
            name: userTable.name,
            username: userTable.username,
            image: userTable.image,
            createdAt: userTable.createdAt,
            banned: userTable.banned
          })
          .from(userTable)
          .where(eq(userTable.username, username))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user: ${(error as Error).message}`,
          operation: 'select',
          table: 'user'
        })
    })

    const foundUser = userRecords[0]
    if (!foundUser || foundUser.banned) {
      return yield* new NotFoundError({
        message: 'User not found',
        resource: 'user',
        id: username
      })
    }

    const userMixes = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: audioTable.id,
            title: audioTable.title,
            slug: audioTable.slug,
            thumbnailUrl: audioTable.thumbnailUrl,
            type: audioTable.type
          })
          .from(audioTable)
          .innerJoin(audioCreators, eq(audioTable.id, audioCreators.audioId))
          .where(
            and(
              eq(audioCreators.creatorId, foundUser.id),
              eq(audioTable.draft, false)
            )
          )
          .orderBy(audioTable.createdAt),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user mixes: ${(error as Error).message}`,
          operation: 'select',
          table: 'audio'
        })
    })

    const userShows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: showsTable.id,
            title: showsTable.title,
            slug: showsTable.slug,
            thumbnailUrl: showsTable.thumbnailUrl
          })
          .from(showsTable)
          .innerJoin(showCreators, eq(showsTable.id, showCreators.showId))
          .where(
            and(
              eq(showCreators.creatorId, foundUser.id),
              eq(showsTable.draft, false)
            )
          )
          .orderBy(showsTable.createdAt),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user shows: ${(error as Error).message}`,
          operation: 'select',
          table: 'shows'
        })
    })

    return {
      id: foundUser.id,
      name: foundUser.name,
      username: foundUser.username,
      image: foundUser.image,
      createdAt: foundUser.createdAt,
      content: {
        mixes: userMixes,
        shows: userShows
      }
    }
  })

export const ProfileServiceLive = Layer.succeed(ProfileService, {
  getPublicProfile: getPublicProfileEffect
})
