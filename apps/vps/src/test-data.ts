import type { z } from 'zod'
import type { insertUserSchema } from './db/auth.schema'
import type { createMixSchema } from './db/mix.schema'
import type { createPostSchema } from './db/post.schema'
import type { selectPublicationSchema } from './db/publication.schema'

export const mixes: Array<z.infer<typeof createMixSchema>> = [
  {
    title: 'Mix 1',
    description: 'Description 1',
    thumbnailUrl: 'https://example.com/thumbnail1.jpg',
    slug: 'mix-1',
    content: 'Content 1',
    creatorIds: ['1', '2'],
    url: 'https://example.com/mix1.mp3',
    draft: false,
    tags: ['dnb', 'techno', 'house']
  }
]

export const users: Array<z.infer<typeof insertUserSchema>> = [
  {
    name: 'User 1',
    email: 'user1@example.com'
  },
  {
    name: 'User 2',
    email: 'user2@example.com'
  }
]

export const posts: Array<z.infer<typeof createPostSchema>> = [
  {
    title: 'Post 1',
    description: 'Description 1',
    thumbnailUrl: 'https://example.com/thumbnail1.jpg',
    slug: 'post-1',
    content: 'Content 1',
    creatorIds: ['1', '2'],
    draft: false,
    tags: ['dnb', 'techno', 'house'],
    type: 'post',
    publicationId: '1'
  },
  {
    title: 'Micro 1',
    description: 'Description 1',
    thumbnailUrl: 'https://example.com/thumbnail1.jpg',
    slug: 'micro-1',
    content: 'Content 1',
    creatorIds: ['1'],
    draft: false,
    tags: ['dnb', 'techno', 'house'],
    type: 'micro',
    publicationId: '1'
  },
  {
    title: 'Label 1',
    description: 'Description 1',
    thumbnailUrl: 'https://example.com/thumbnail1.jpg',
    slug: 'label-1',
    content: 'Content 1',
    creatorIds: ['1'],
    draft: false,
    tags: ['dnb', 'techno', 'house'],
    type: 'post',
    publicationId: '1'
  }
]

export const publications: Array<z.infer<typeof selectPublicationSchema>> = [
  {
    id: '1',
    name: 'Publication 1',
    description: 'Description 1',
    slug: 'publication-1'
  }
]
