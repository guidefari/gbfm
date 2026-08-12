import { expect, test } from 'vitest'
import { canCreatePosts, hasMinRole } from './index'

test('enforces the role hierarchy and denies post creation to missing or unrecognized roles', () => {
  expect([
    hasMinRole('admin', 'editor'),
    hasMinRole('editor', 'editor'),
    hasMinRole('creator', 'editor'),
    hasMinRole('user', 'creator')
  ]).toEqual([true, true, false, false])

  expect([null, undefined, '', 'superuser'].map((role) => hasMinRole(role, 'creator'))).toEqual([
    false,
    false,
    false,
    false
  ])

  expect(['creator', 'editor', 'admin', 'user', null].map(canCreatePosts)).toEqual([
    true,
    true,
    true,
    false,
    false
  ])
})
