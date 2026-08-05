'use client'

import { canCreatePosts } from '@gbfm/core/roles'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { signInRedirect } from '@/lib/route-guards'
import { TweetCapturePage } from './-TweetCapturePage'

const searchSchema = z.object({
  edit: z.string().optional()
})

export const Route = createFileRoute('/new/tweet')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw signInRedirect(location.href)
    }
    if (!canCreatePosts(context.auth.user?.role)) {
      throw redirect({ to: '/' })
    }
  },
  validateSearch: searchSchema,
  component: TweetCapturePage
})
