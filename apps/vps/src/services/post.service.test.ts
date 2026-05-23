import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import type { SelectMdxCompiledPost } from '@/db/post.schema'
import { DatabaseError, ValidationError } from '@/errors'
import {
  normalizePostData,
  toEditorialPost,
  toMicroPost,
  validatePostData
} from './post.service'

const basePost: SelectMdxCompiledPost = {
  id: '00000000-0000-0000-0000-000000000000',
  title: 'Title',
  description: null,
  thumbnailUrl: null,
  bannerImageUrl: null,
  slug: 'title',
  content: 'Body',
  draft: false,
  tags: null,
  type: 'post',
  musicEntityType: null,
  musicEntityId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  compiledContent: '',
  creators: []
}

describe('validatePostData', () => {
  test('allows a tweet with only a title', async () => {
    await expect(
      Effect.runPromise(
        validatePostData({ type: 'micro', title: 'Track is wild' })
      )
    ).resolves.toBeUndefined()
  })

  test('allows a tweet with only content', async () => {
    await expect(
      Effect.runPromise(
        validatePostData({ type: 'micro', content: 'Track is wild' })
      )
    ).resolves.toBeUndefined()
  })

  test('allows a post with surrounding whitespace', async () => {
    await expect(
      Effect.runPromise(
        validatePostData({ type: 'post', title: ' Title ', content: ' Body ' })
      )
    ).resolves.toBeUndefined()
  })

  test('rejects a tweet without title or content', async () => {
    await expect(
      Effect.runPromise(
        validatePostData({ type: 'micro', title: ' ', content: null })
      )
    ).rejects.toEqual(
      new ValidationError({ message: 'Tweet title or body is required' })
    )
  })

  test('rejects a regular post without a title', async () => {
    await expect(
      Effect.runPromise(validatePostData({ type: 'post', content: 'Body' }))
    ).rejects.toEqual(
      new ValidationError({ message: 'Post title is required' })
    )
  })

  test('rejects a regular post without content', async () => {
    await expect(
      Effect.runPromise(validatePostData({ type: 'post', title: 'Title' }))
    ).rejects.toEqual(
      new ValidationError({ message: 'Post content is required' })
    )
  })
})

describe('normalizePostData', () => {
  test('normalizes empty tweet title and content to null', async () => {
    expect(normalizePostData({ title: ' ', content: '' }, 'micro')).toEqual({
      title: null,
      content: null
    })
  })

  test('preserves non-empty tweet title and content', async () => {
    expect(
      normalizePostData({ title: ' Title ', content: ' Body ' }, 'micro')
    ).toEqual({ title: ' Title ', content: ' Body ' })
  })

  test('does not normalize regular post data', async () => {
    expect(normalizePostData({ title: ' ', content: '' }, 'post')).toEqual({
      title: ' ',
      content: ''
    })
  })

  test('does not add absent fields while normalizing tweets', async () => {
    expect(normalizePostData({ title: ' ' }, 'micro')).toEqual({ title: null })
  })
})

describe('post type refinement', () => {
  test('refines complete editorial posts to non-null title and content', async () => {
    await expect(Effect.runPromise(toEditorialPost(basePost))).resolves.toEqual(
      basePost
    )
  })

  test('rejects editorial posts without title or content', async () => {
    await expect(
      Effect.runPromise(
        toEditorialPost({ ...basePost, title: null, content: 'Body' })
      )
    ).rejects.toEqual(
      new DatabaseError({
        message: 'Expected editorial post with title and content: title',
        operation: 'post_type_refinement',
        table: 'posts'
      })
    )
  })

  test('refines micro posts separately from editorial posts', async () => {
    const microPost = { ...basePost, type: 'micro' as const, title: null }

    await expect(Effect.runPromise(toMicroPost(microPost))).resolves.toEqual(
      microPost
    )
  })
})
