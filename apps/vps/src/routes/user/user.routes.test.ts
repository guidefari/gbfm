import { describe, expect, it } from 'vitest'
import { getSocialLinks, replaceSocialLinks } from './user.routes'

describe('user.routes social links', () => {
  it('defines get social links route', () => {
    expect(getSocialLinks.path).toBe('/profile/social-links')
    expect(getSocialLinks.method).toBe('get')
    expect(getSocialLinks.responses[200]).toBeDefined()
    expect(getSocialLinks.responses[401]).toBeDefined()
    expect(getSocialLinks.responses[404]).toBeDefined()
    expect(getSocialLinks.responses[500]).toBeDefined()
  })

  it('defines replace social links route', () => {
    expect(replaceSocialLinks.path).toBe('/profile/social-links')
    expect(replaceSocialLinks.method).toBe('put')
    expect(replaceSocialLinks.request?.body).toBeDefined()
    expect(replaceSocialLinks.responses[200]).toBeDefined()
    expect(replaceSocialLinks.responses[400]).toBeDefined()
    expect(replaceSocialLinks.responses[404]).toBeDefined()
    expect(replaceSocialLinks.responses[401]).toBeDefined()
    expect(replaceSocialLinks.responses[500]).toBeDefined()
  })
})
