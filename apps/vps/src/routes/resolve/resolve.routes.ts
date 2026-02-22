import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent } from 'stoker/openapi/helpers'

const tags = ['Resolve']

const resolveResponseSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('profile'),
      data: z.object({
        id: z.string(),
        name: z.string(),
        username: z.string().nullable(),
        image: z.string().nullable(),
        createdAt: z.date(),
        content: z.object({
          mixes: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              slug: z.string(),
              thumbnailUrl: z.string().nullable(),
              type: z.enum(['mix', 'track', 'misc'])
            })
          ),
          shows: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              slug: z.string(),
              thumbnailUrl: z.string().nullable()
            })
          ),
          editorials: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              slug: z.string(),
              thumbnailUrl: z.string().nullable(),
              description: z.string().nullable(),
              createdAt: z.date()
            })
          ),
          tweets: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              slug: z.string(),
              createdAt: z.date()
            })
          )
        })
      })
    }),
    z.object({
      type: z.literal('show'),
      data: z.object({
        id: z.string(),
        title: z.string(),
        slug: z.string(),
        description: z.string().nullable(),
        thumbnailUrl: z.string().nullable(),
        compiledContent: z.string().nullable(),
        hosts: z.array(z.object({ id: z.string(), name: z.string() }))
      })
    })
  ])
  .openapi('ResolveResponse')

export const resolveSlug = createRoute({
  path: '/{slug}',
  method: 'get',
  request: {
    params: z.object({
      slug: z.string()
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      resolveResponseSchema,
      'Resolved entity (profile or show)'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Slug not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to resolve slug'
    )
  }
})

export type ResolveSlugRoute = typeof resolveSlug
