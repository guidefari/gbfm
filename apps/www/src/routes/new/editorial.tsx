'use client'

import { createFileRoute, redirect } from '@tanstack/react-router'
import { Schema } from 'effect'
import { signInRedirect } from '@/lib/route-guards'
import { EditorialPage } from './-EditorialPage'

const searchSchema = Schema.Struct({
  edit: Schema.optional(Schema.String)
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
  validateSearch: Schema.toStandardSchemaV1(searchSchema),
  component: EditorialPage
})
