import { z } from 'zod'
import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, pgEnum, pgTable, primaryKey, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { user } from './auth.schema'
import { defaultContentFields } from './util'

export const POST_MUSIC_ENTITY_TYPES = ['album', 'track', 'playlist'] as const
export type PostMusicEntityType = (typeof POST_MUSIC_ENTITY_TYPES)[number]

export const postTypeEnum = pgEnum('post_type', ['post', 'micro'])
// todo: derive this at some point bossman
export type PostType = 'post' | 'micro'

const { title, content, ...postContentFields } = defaultContentFields

export const postsTable = pgTable(
  'posts',
  {
    ...postContentFields,
    title: varchar({ length: 255 }),
    content: text(),
    type: postTypeEnum(),
    musicEntityType: text('music_entity_type'),
    musicEntityId: uuid('music_entity_id')
  },
  (table) => [
    index('posts_slug_idx').on(table.slug),
    index('posts_music_entity_idx').on(table.musicEntityType, table.musicEntityId),
    index('posts_type_created_idx').on(table.type, table.createdAt),
    index('posts_tags_gin_idx').using('gin', table.tags)
  ]
)

export type SelectPost = InferSelectModel<typeof postsTable>
export type InsertPost = InferInsertModel<typeof postsTable>

export type SelectMdxCompiledPost = SelectPost & {
  compiledContent: string
  creators?: Array<{
    id: string
    name: string
    username: string | null
  }>
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
    .optional()
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

export const postCreators = pgTable(
  'post_creators',
  {
    postId: uuid()
      .notNull()
      .references(() => postsTable.id),
    creatorId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.postId, t.creatorId] })]
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
