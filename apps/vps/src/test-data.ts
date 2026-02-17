import type { z } from 'zod'
import type { insertUserSchema } from './db/auth.schema'
import type { createPostSchema } from './db/post.schema'

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
    type: 'post'
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
    type: 'micro'
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
    type: 'post'
  }
]
