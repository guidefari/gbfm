import { describe, expect, test } from 'vitest'
import {
  audioListQueryKey,
  audioSlugQueryKey,
  audioTagsQueryKey,
  favoritesQueryKey,
  userSubscriptionsQueryKey
} from './http-query-keys'

describe('http query keys', () => {
  test('normalizes absent audio tags to null', () => {
    expect(audioListQueryKey('mix', undefined, 5)).toEqual(['audio', 'mix', null, 5])
  })

  test('preserves audio list tag values', () => {
    expect(audioListQueryKey('track', 'ambient', 10)).toEqual(['audio', 'track', 'ambient', 10])
  })

  test('builds audio tags and slug keys', () => {
    expect(audioTagsQueryKey('misc')).toEqual(['audio-tags', 'misc'])
    expect(audioSlugQueryKey('mix', 'deep-listening')).toEqual(['audio', 'mix', 'deep-listening'])
  })

  test('builds shared mutation invalidation keys', () => {
    expect(favoritesQueryKey()).toEqual(['favorites'])
    expect(userSubscriptionsQueryKey()).toEqual(['user-subscriptions'])
  })
})
