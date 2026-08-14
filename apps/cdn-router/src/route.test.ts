import { describe, expect, test } from 'vitest'
import { matchRoute } from './route'

const buckets = {
  USER_CONTENT: 'user-content-bucket',
  MIXES: 'mixes-bucket'
} as const

describe('matchRoute', () => {
  test('routes user-content paths and strips only the leading prefix', () => {
    expect(matchRoute('/user-content/a/b.jpg', buckets)).toEqual({
      bucket: 'user-content-bucket',
      key: 'a/b.jpg'
    })
    expect(matchRoute('/user-content/a/mixes/b.jpg', buckets)).toEqual({
      bucket: 'user-content-bucket',
      key: 'a/mixes/b.jpg'
    })
  })

  test('routes mixes paths', () => {
    expect(matchRoute('/mixes/x.mp3', buckets)).toEqual({
      bucket: 'mixes-bucket',
      key: 'x.mp3'
    })
  })

  test('rejects unmatched and empty object paths', () => {
    expect(matchRoute('/other', buckets)).toBeNull()
    expect(matchRoute('/user-content/', buckets)).toBeNull()
    expect(matchRoute('/mixes/', buckets)).toBeNull()
  })
})
