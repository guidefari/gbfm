import { describe, expect, it } from 'vitest'

import { Principal, type Principal as PrincipalType } from '@/lib/auth/principal'

import { isPathActive, navSections } from './nav-config'

const principalWithRole = (role: 'user' | 'creator' | 'editor' | 'admin'): PrincipalType =>
  Principal.Authenticated({
    userId: 'user-1',
    name: 'Test',
    email: 'test@example.com',
    role,
    imageUrl: undefined,
    username: undefined,
    emailVerified: true,
  })

const createIds = (principal: PrincipalType) => navSections(principal).create.map((item) => item.id)

describe('navSections', () => {
  it('hides create items from anonymous visitors', () => {
    expect(createIds(Principal.Anonymous())).toEqual([])
  })

  it('shows only my content to creators', () => {
    expect(createIds(principalWithRole('creator'))).toEqual(['my-content'])
  })

  it('shows publishing tools to editors', () => {
    expect(createIds(principalWithRole('editor'))).toEqual(['my-content', 'new-mix', 'new-post'])
  })

  it('shows every create item to admins', () => {
    expect(createIds(principalWithRole('admin'))).toEqual([
      'my-content',
      'new-mix',
      'new-post',
      'manage-labels',
    ])
  })
})

describe('isPathActive', () => {
  it('matches home only on the root path', () => {
    expect(isPathActive('/', { href: '/' })).toBe(true)
    expect(isPathActive('/shows', { href: '/' })).toBe(false)
  })

  it('matches nested paths', () => {
    expect(isPathActive('/shows/far-end-radio', { href: '/shows' })).toBe(true)
  })

  it('does not match sibling prefixes', () => {
    expect(isPathActive('/showsy', { href: '/shows' })).toBe(false)
  })

  it('matches extra prefixes', () => {
    expect(isPathActive('/tweet/abc', { href: '/tweets', matches: ['/tweet'] })).toBe(true)
  })
})
