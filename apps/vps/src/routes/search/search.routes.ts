import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent } from 'stoker/openapi/helpers'

const tags = ['Search']

const searchResultItemSchema = z
  .object({
    id: z.string(),
    title: z.string().nullable(),
    slug: z.string(),
    type: z.string().openapi({ description: 'Content type, e.g. show, mix, post, micro' }),
    thumbnailUrl: z.string().nullable(),
    description: z.string().nullable()
  })
  .openapi('SearchResultItem')

const searchResultsSchema = z
  .object({
    shows: z.array(searchResultItemSchema),
    audio: z.array(searchResultItemSchema),
    posts: z.array(searchResultItemSchema)
  })
  .openapi('SearchResults')

export const searchContent = createRoute({
  path: '/',
  method: 'get',
  request: {
    query: z.object({
      q: z.string().min(1).openapi({ description: 'Search query' }),
      limit: z.coerce.number().min(1).max(50).optional().default(10).openapi({
        description: 'Max results per content type'
      })
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(searchResultsSchema, 'Grouped search results'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to search content'
    )
  }
})

export type SearchContentRoute = typeof searchContent
