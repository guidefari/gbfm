import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access'

const statement = {
  ...defaultStatements,
  audio: ['create', 'read', 'update', 'delete', 'publish', 'manage'],
  post: ['create', 'read', 'update', 'delete', 'publish', 'manage'],
  mix: ['create', 'read', 'update', 'delete', 'publish', 'manage'],
  release: ['create', 'read', 'update', 'delete', 'publish', 'manage'],
  label: ['create', 'read', 'update', 'delete', 'publish', 'manage']
} as const

export const ac = createAccessControl(statement)

export const userRole = ac.newRole({
  audio: ['read'],
  post: ['read'],
  mix: ['read'],
  release: ['read'],
  label: ['read']
})

export const creator = ac.newRole({
  audio: ['create', 'read', 'update', 'delete'],
  post: ['create', 'read', 'update', 'delete'],
  mix: ['create', 'read', 'update', 'delete'],
  release: ['create', 'read', 'update', 'delete'],
  label: ['create', 'read', 'update', 'delete']
})

export const editor = ac.newRole({
  audio: ['create', 'read', 'update', 'delete', 'publish'],
  post: ['create', 'read', 'update', 'delete', 'publish'],
  mix: ['create', 'read', 'update', 'delete', 'publish'],
  release: ['create', 'read', 'update', 'delete', 'publish'],
  label: ['create', 'read', 'update', 'delete', 'publish']
})

export const admin = ac.newRole({
  ...adminAc.statements,
  audio: ['manage'],
  post: ['manage'],
  mix: ['manage'],
  release: ['manage'],
  label: ['manage']
})
