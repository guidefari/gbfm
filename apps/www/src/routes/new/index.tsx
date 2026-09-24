'use client'

import { canCreatePosts } from '@gbfm/core/roles'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Schema } from 'effect'
import { signInRedirect } from '@/lib/route-guards'
import { privateHead } from '@/lib/seo'
import { NewContentPage } from './-NewContentPage'

const searchSchema = Schema.Struct({
  mode: Schema.optional(Schema.Literals(['tweet', 'editorial'])),
  edit: Schema.optional(Schema.String)
})

export const Route = createFileRoute('/new/')({
  head: () => privateHead('Write a post'),
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw signInRedirect(location.href)
    }
    if (!canCreatePosts(context.auth.user?.role)) {
      throw redirect({ to: '/' })
    }
  },
  validateSearch: Schema.toStandardSchemaV1(searchSchema),
  component: NewContentPage
})
