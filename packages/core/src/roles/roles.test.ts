import { describe, expect, it } from 'vitest'
import { canCreatePosts, hasMinRole } from './index'

describe('hasMinRole', () => {
  it('ranks roles from user up to admin', () => {
    expect(hasMinRole('admin', 'editor')).toBe(true)
    expect(hasMinRole('editor', 'editor')).toBe(true)
    expect(hasMinRole('creator', 'editor')).toBe(false)
    expect(hasMinRole('user', 'creator')).toBe(false)
  })

  it('treats missing and unknown roles as no access', () => {
    expect(hasMinRole(null, 'creator')).toBe(false)
    expect(hasMinRole(undefined, 'creator')).toBe(false)
    expect(hasMinRole('', 'creator')).toBe(false)
    expect(hasMinRole('superuser', 'creator')).toBe(false)
  })
})

describe('canCreatePosts', () => {
  it('admits exactly the roles the old POST_CREATE_ROLES set admitted', () => {
    expect(canCreatePosts('creator')).toBe(true)
    expect(canCreatePosts('editor')).toBe(true)
    expect(canCreatePosts('admin')).toBe(true)
    expect(canCreatePosts('user')).toBe(false)
    expect(canCreatePosts(null)).toBe(false)
  })
})
