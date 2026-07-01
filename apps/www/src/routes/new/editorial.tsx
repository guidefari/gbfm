'use client'

import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { signInRedirect } from '@/lib/route-guards'
import { EditorialPage } from './-EditorialPage'

const searchSchema = z.object({
  edit: z.string().optional()
})

export const Route = createFileRoute('/new/editorial')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw signInRedirect(location.href)
    }
    if (context.auth.user?.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  validateSearch: searchSchema,
  component: EditorialPage
})
