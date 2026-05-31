import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent } from 'stoker/openapi/helpers'
import { userSocialLinkSchema } from '@/db/auth.schema'

const tags = ['Profile']

const publicProfileResponseSchema = z
  .object({
    id: z.string().openapi({ description: 'User ID' }),
    name: z.string().openapi({ description: 'User display name' }),
    username: z.string().nullable().openapi({ description: 'Username' }),
    image: z.string().nullable().openapi({ description: 'User profile image' }),
    bio: z.string().nullable().openapi({ description: 'User biography' }),
    socialLinks: z.array(userSocialLinkSchema).openapi({ description: 'Ordered social links' }),
    createdAt: z.date().openapi({ description: 'Account creation date' }),
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
      )
    })
  })
  .openapi('PublicProfile')

export const getPublicProfile = createRoute({
  path: '/{username}',
  method: 'get',
  request: {
    params: z.object({
      username: z.string()
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(publicProfileResponseSchema, 'Public profile data'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ error: z.string() }), 'User not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch profile'
    )
  }
})

export type GetPublicProfileRoute = typeof getPublicProfile
