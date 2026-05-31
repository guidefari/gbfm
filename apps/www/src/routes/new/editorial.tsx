'use client'

import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { EditorialPage } from './-EditorialPage'

const searchSchema = z.object({
  edit: z.string().optional()
})

export const Route = createFileRoute('/new/editorial')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/auth/sign-in' })
    }
    if (context.auth.user?.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  validateSearch: searchSchema,
  component: EditorialPage
})
