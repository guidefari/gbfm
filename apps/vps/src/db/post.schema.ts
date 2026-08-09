import { z } from 'zod'
import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  primaryKey,
  text
} from 'drizzle-orm/sqlite-core'
import { user } from './auth.schema'
import { defaultContentFields } from './util'

export const POST_MUSIC_ENTITY_TYPES = ['album', 'track', 'playlist'] as const
export type PostMusicEntityType = (typeof POST_MUSIC_ENTITY_TYPES)[number]

export const postTypeEnum = ['post', 'micro'] as const
// todo: derive this at some point bossman
export type PostType = 'post' | 'micro'

const { title, content, ...postContentFields } = defaultContentFields

export const postsTable = sqliteTable(
  'posts',
  {
    ...postContentFields,
    title: text(),
    content: text(),
    type: text({ enum: postTypeEnum }),
    musicEntityType: text('music_entity_type'),
    musicEntityId: text('music_entity_id'),
    parentPostId: text('parent_post_id').references((): AnySQLiteColumn => postsTable.id, {
      onDelete: 'set null'
    }),
    rootPostId: text('root_post_id').references((): AnySQLiteColumn => postsTable.id, {
      onDelete: 'set null'
    }),
    depth: integer('depth').notNull().default(0),
    quotedPostId: text('quoted_post_id').references((): AnySQLiteColumn => postsTable.id, {
      onDelete: 'set null'
    })
  },
  (table) => [
    index('posts_slug_idx').on(table.slug),
    index('posts_music_entity_idx').on(table.musicEntityType, table.musicEntityId),
    index('posts_type_created_idx').on(table.type, table.createdAt),
    index('posts_parent_created_idx').on(table.parentPostId, table.createdAt),
    index('posts_root_created_idx').on(table.rootPostId, table.createdAt),
    index('posts_quoted_post_idx').on(table.quotedPostId)
  ]
)

export type SelectPost = InferSelectModel<typeof postsTable> & { tags: string[] | null }
export type InsertPost = InferInsertModel<typeof postsTable> & { tags?: string[] }

export type BlueskySourceAttribution = {
  readonly authorDid: string
  readonly authorHandle: string | null
  readonly publicUrl: string
  readonly sourceCreatedAt: Date | string
  readonly sourceStatus: string
  readonly locallyEdited: boolean
  readonly lastError: string | null
}

export type SelectMdxCompiledPost = SelectPost & {
  compiledContent: string
  blueskySource?: BlueskySourceAttribution
  creators?: Array<{
    id: string
    name: string
    username: string | null
  }>
  replyCount?: number
}

export type SelectMdxCompiledEditorialPost = SelectMdxCompiledPost & {
  title: string
  content: string
  type: 'post'
}

export type SelectMdxCompiledMicroPost = SelectMdxCompiledPost & {
  type: 'micro'
}

export const selectPostSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  slug: z.string(),
  content: z.string().nullable(),
  draft: z.boolean(),
  tags: z.array(z.string()).nullable(),
  type: z.enum(['post', 'micro']).nullable(),
  musicEntityType: z.string().nullable(),
  musicEntityId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const selectMdxCompiledPostSchema = selectPostSchema.extend({
  compiledContent: z.string(),
  creators: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        username: z.string().nullable()
      })
    )
    .optional(),
  replyCount: z.number().optional()
})

export const selectMdxCompiledEditorialPostSchema = selectMdxCompiledPostSchema.extend({
  title: z.string(),
  content: z.string(),
  type: z.literal('post')
})

export const selectMdxCompiledMicroPostSchema = selectMdxCompiledPostSchema.extend({
  type: z.literal('micro')
})

export const insertPostSchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  slug: z.string().min(1),
  content: z.string().nullable().optional(),
  draft: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  type: z.enum(['post', 'micro']).nullable().optional(),
  musicEntityType: z.enum(POST_MUSIC_ENTITY_TYPES).nullable().optional(),
  musicEntityId: z.string().uuid().nullable().optional()
})

export const createPostSchema = insertPostSchema.extend({
  creatorIds: z.array(z.string()).min(1).optional()
})

export const updatePostSchema = insertPostSchema.partial()

export const postCreators = sqliteTable(
  'post_creators',
  {
    postId: text()
      .notNull()
      .references(() => postsTable.id),
    creatorId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.creatorId] }),
    index('post_creators_creatorId_idx').on(t.creatorId)
  ]
)

export const postsRelations = relations(postsTable, ({ many }) => ({
  postCreators: many(postCreators)
}))

export const postCreatorsRelations = relations(postCreators, ({ one }) => ({
  post: one(postsTable, {
    fields: [postCreators.postId],
    references: [postsTable.id]
  }),
  creator: one(user, {
    fields: [postCreators.creatorId],
    references: [user.id]
  })
}))
