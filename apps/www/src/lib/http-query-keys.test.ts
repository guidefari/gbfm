import { describe, expect, test } from 'vitest'
import {
  audioListQueryKey,
  audioSlugQueryKey,
  audioTagsQueryKey,
  favoritesQueryKey,
  userSubscriptionsQueryKey
} from './http-query-keys'

describe('http query keys', () => {
  test('builds stable cache keys for audio queries and shared invalidations', () => {
    expect(audioListQueryKey('mix', undefined, 5)).toEqual(['audio', 'mix', null, 5])
    expect(audioListQueryKey('track', 'ambient', 10)).toEqual(['audio', 'track', 'ambient', 10])
    expect(audioTagsQueryKey('misc')).toEqual(['audio-tags', 'misc'])
    expect(audioSlugQueryKey('mix', 'deep-listening')).toEqual(['audio', 'mix', 'deep-listening'])
    expect(favoritesQueryKey()).toEqual(['favorites'])
    expect(userSubscriptionsQueryKey()).toEqual(['user-subscriptions'])
  })
})
