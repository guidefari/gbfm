import { z } from '@hono/zod-openapi'
import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid
} from 'drizzle-orm/pg-core'
import { user } from './auth.schema'
import { defaultContentFields } from './util'

export const POST_MUSIC_ENTITY_TYPES = ['album', 'track', 'playlist'] as const
export type PostMusicEntityType = (typeof POST_MUSIC_ENTITY_TYPES)[number]

export const postTypeEnum = pgEnum('post_type', ['post', 'micro'])
// todo: derive this at some point bossman
export type PostType = 'post' | 'micro'

export const postsTable = pgTable(
  'posts',
  {
    ...defaultContentFields,
    type: postTypeEnum(),
    musicEntityType: text('music_entity_type'),
    musicEntityId: uuid('music_entity_id')
  },
  (table) => [
    index('posts_slug_idx').on(table.slug),
    index('posts_music_entity_idx').on(
      table.musicEntityType,
      table.musicEntityId
    )
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

export const selectPostSchema = z
  .object({
    id: z.string().openapi({ description: 'Unique identifier for the post' }),
    title: z.string().openapi({ description: 'Title of the post' }),
    description: z
      .string()
      .nullable()
      .openapi({ description: 'Description of the post' }),
    thumbnailUrl: z
      .string()
      .nullable()
      .openapi({ description: 'Thumbnail URL for the post' }),
    slug: z.string().openapi({ description: 'URL slug for the post' }),
    content: z.string().openapi({ description: 'Content of the post' }),
    draft: z.boolean().openapi({ description: 'Whether the post is a draft' }),
    tags: z
      .array(z.string())
      .nullable()
      .openapi({ description: 'Tags associated with the post' }),
    type: z
      .enum(['post', 'micro'])
      .nullable()
      .openapi({ description: 'Type of the post' }),
    musicEntityType: z
      .string()
      .nullable()
      .openapi({ description: 'Attached music entity type' }),
    musicEntityId: z
      .string()
      .uuid()
      .nullable()
      .openapi({ description: 'Attached music entity ID' }),
    createdAt: z.date().openapi({ description: 'Creation timestamp' }),
    updatedAt: z.date().openapi({ description: 'Last update timestamp' })
  })
  .openapi('Post')

export const selectMdxCompiledPostSchema = selectPostSchema
  .extend({
    compiledContent: z
      .string()
      .openapi({ description: 'Compiled MDX content' }),
    creators: z
      .array(
        z
          .object({
            id: z.string().openapi({ description: 'Creator ID' }),
            name: z.string().openapi({ description: 'Creator name' }),
            username: z
              .string()
              .nullable()
              .openapi({ description: 'Creator username' })
          })
          .openapi('Creator')
      )
      .optional()
      .openapi({ description: 'List of creators for this post' })
  })
  .openapi('CompiledPost')

export const insertPostSchema = z
  .object({
    title: z
      .string()
      .min(1)
      .openapi({ description: 'Title of the post', example: 'My Blog Post' }),
    description: z
      .string()
      .optional()
      .openapi({ description: 'Description of the post' }),
    thumbnailUrl: z
      .string()
      .optional()
      .openapi({ description: 'Thumbnail URL for the post' }),
    slug: z.string().min(1).openapi({
      description: 'URL slug for the post',
      example: 'my-blog-post'
    }),
    content: z
      .string()
      .optional()
      .default('')
      .openapi({ description: 'Content of the post' }),
    draft: z
      .boolean()
      .optional()
      .openapi({ description: 'Whether this is a draft', default: false }),
    tags: z
      .array(z.string())
      .optional()
      .openapi({ description: 'Tags for the post' }),
    type: z
      .enum(['post', 'micro'])
      .nullable()
      .optional()
      .openapi({ description: 'Type of the post' }),
    musicEntityType: z
      .enum([...POST_MUSIC_ENTITY_TYPES] as [
        PostMusicEntityType,
        ...PostMusicEntityType[]
      ])
      .nullable()
      .optional()
      .openapi({ description: 'Attached music entity type' }),
    musicEntityId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .openapi({ description: 'Attached music entity ID' })
  })
  .openapi('InsertPost')

export const createPostSchema = insertPostSchema
  .extend({
    creatorIds: z
      .array(z.string())
      .min(1)
      .optional()
      .openapi({ description: 'IDs of post creators' })
  })
  .openapi('CreatePostRequest')

export const updatePostSchema = insertPostSchema
  .partial()
  .openapi('UpdatePostRequest')

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
