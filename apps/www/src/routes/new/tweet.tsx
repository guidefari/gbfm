'use client'

import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { signInRedirect } from '@/lib/route-guards'
import { TweetCapturePage } from './-TweetCapturePage'

const searchSchema = z.object({
  edit: z.string().optional()
})

const POST_CREATE_ROLES = new Set(['creator', 'editor', 'admin'])

export const Route = createFileRoute('/new/tweet')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw signInRedirect(location.href)
    }
    if (!POST_CREATE_ROLES.has(context.auth.user?.role ?? '')) {
      throw redirect({ to: '/' })
    }
  },
  validateSearch: searchSchema,
  component: TweetCapturePage
})
