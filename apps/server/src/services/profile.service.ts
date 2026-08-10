import { and, asc, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { audioCreators, audioTable } from '@/db/audio.schema'
import { audioIdsForCreator } from '@/db/creator-membership'
import { Database } from '@/db/layer'
import {
  SOCIAL_LINK_PLATFORMS,
  type SocialLinkPlatform,
  userSocialLinks,
  user as userTable
} from '@/db/auth.schema'
import { postCreators, postsTable } from '@/db/post.schema'
import { showCreators, showsTable } from '@/db/show.schema'
import { DatabaseError, getErrorMessage, NotFoundError } from '@/errors'

function isSocialLinkPlatform(value: string): value is SocialLinkPlatform {
  return SOCIAL_LINK_PLATFORMS.some((platform) => platform === value)
}

export type PublicProfile = {
  id: string
  name: string
  username: string | null
  image: string | null
  bio: string | null
  socialLinks: Array<{
    platform: SocialLinkPlatform
    url: string
    position: number
  }>
  createdAt: Date
  content: {
    mixes: Array<{
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
      type: 'mix' | 'track' | 'misc'
      showId: string | null
    }>
    shows: Array<{
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
    }>
    editorials: Array<{
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
      description: string | null
      createdAt: Date
    }>
    tweets: Array<{
      id: string
      title: string | null
      slug: string
      createdAt: Date
    }>
  }
}

export interface ProfileService {
  readonly getPublicProfile: (
    username: string
  ) => Effect.Effect<PublicProfile, DatabaseError | NotFoundError>
}

export const ProfileService = Context.Service<ProfileService>('ProfileService')

export const getPublicProfileEffect = (username: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    const userRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: userTable.id,
            name: userTable.name,
            username: userTable.username,
            image: userTable.image,
            bio: userTable.bio,
            createdAt: userTable.createdAt,
            banned: userTable.banned
          })
          .from(userTable)
          .where(eq(userTable.username, username))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'user'
        })
    }).pipe(Effect.withSpan('profile.getPublic.user', { attributes: { username } }))

    const foundUser = userRecords[0]
    if (!foundUser || foundUser.banned) {
      return yield* new NotFoundError({
        message: 'User not found',
        resource: 'user',
        id: username
      })
    }

    const socialLinks = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            platform: userSocialLinks.platform,
            url: userSocialLinks.url,
            position: userSocialLinks.position
          })
          .from(userSocialLinks)
          .where(eq(userSocialLinks.userId, foundUser.id))
          .orderBy(asc(userSocialLinks.position)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user social links: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'user_social_links'
        })
    }).pipe(
      Effect.withSpan('profile.getPublic.socialLinks', { attributes: { userId: foundUser.id } })
    )

    const userMixes = yield* Effect.tryPromise({
      try: () =>
        db.query.audioTable.findMany({
          columns: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            type: true,
            showId: true
          },
          with: {
            show: {
              columns: { thumbnailUrl: true }
            }
          },
          where: and(audioIdsForCreator(db, foundUser.id), eq(audioTable.draft, false)),
          orderBy: asc(audioTable.createdAt)
        }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user mixes: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio'
        })
    }).pipe(
      Effect.map((rows) =>
        rows.map(({ show, ...row }) => ({
          ...row,
          thumbnailUrl: row.thumbnailUrl ?? show?.thumbnailUrl ?? null
        }))
      ),
      Effect.withSpan('profile.getPublic.mixes', { attributes: { userId: foundUser.id } })
    )

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
          .where(and(eq(showCreators.creatorId, foundUser.id), eq(showsTable.draft, false)))
          .orderBy(showsTable.createdAt),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user shows: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'shows'
        })
    }).pipe(Effect.withSpan('profile.getPublic.shows', { attributes: { userId: foundUser.id } }))

    const userPosts = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: postsTable.id,
            title: postsTable.title,
            slug: postsTable.slug,
            thumbnailUrl: postsTable.thumbnailUrl,
            description: postsTable.description,
            type: postsTable.type,
            createdAt: postsTable.createdAt
          })
          .from(postsTable)
          .innerJoin(postCreators, eq(postsTable.id, postCreators.postId))
          .where(and(eq(postCreators.creatorId, foundUser.id), eq(postsTable.draft, false)))
          .orderBy(postsTable.createdAt),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user posts: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    }).pipe(Effect.withSpan('profile.getPublic.posts', { attributes: { userId: foundUser.id } }))

    const editorials = userPosts
      .filter((p): p is typeof p & { title: string } => Boolean(p.type === 'post' && p.title))
      .map(({ type, ...rest }) => rest)

    const tweets = userPosts
      .filter((p) => p.type === 'micro')
      .map(({ type, thumbnailUrl, description, ...rest }) => rest)

    return {
      id: foundUser.id,
      name: foundUser.name,
      username: foundUser.username,
      image: foundUser.image,
      bio: foundUser.bio,
      socialLinks: socialLinks.flatMap((link) =>
        isSocialLinkPlatform(link.platform)
          ? [{ platform: link.platform, url: link.url, position: link.position }]
          : []
      ),
      createdAt: foundUser.createdAt,
      content: {
        mixes: userMixes,
        shows: userShows,
        editorials,
        tweets
      }
    }
  })

export const ProfileServiceLayer = Layer.effect(
  ProfileService,
  Effect.gen(function* () {
    const db = yield* Database
    return {
      getPublicProfile: (username) =>
        getPublicProfileEffect(username).pipe(
          Effect.provideService(Database, db),
          Effect.withSpan('profile.getPublic', { attributes: { username } })
        )
    }
  })
)
