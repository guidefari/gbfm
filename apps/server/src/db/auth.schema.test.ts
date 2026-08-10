import { describe, expect, it } from 'vitest'
import {
  SOCIAL_LINK_PLATFORMS,
  socialLinkPlatformSchema,
  userSocialLinkSchema
} from './auth.schema'

describe('auth.schema social links', () => {
  it('supports the expected platform list', () => {
    expect(SOCIAL_LINK_PLATFORMS).toEqual([
      'bandcamp',
      'substack',
      'soundcloud',
      'instagram',
      'twitter',
      'tiktok'
    ])
  })

  it('validates platform enum values', () => {
    expect(socialLinkPlatformSchema.parse('soundcloud')).toBe('soundcloud')
    expect(() => socialLinkPlatformSchema.parse('facebook')).toThrow()
  })

  it('validates social link payload shape', () => {
    const parsed = userSocialLinkSchema.parse({
      platform: 'instagram',
      url: 'https://instagram.com/example',
      position: 0
    })

    expect(parsed.platform).toBe('instagram')
    expect(() =>
      userSocialLinkSchema.parse({
        platform: 'instagram',
        url: 'not-a-url',
        position: 0
      })
    ).toThrow()
    expect(() =>
      userSocialLinkSchema.parse({
        platform: 'instagram',
        url: 'https://instagram.com/example',
        position: -1
      })
    ).toThrow()
  })
})
