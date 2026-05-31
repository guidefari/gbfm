'use client'

import { createFileRoute } from '@tanstack/react-router'
import { EditorialPage } from './-EditorialPage'

export const Route = createFileRoute('/new/editorial')({
  validateSearch: (search) => ({
    edit: typeof search.edit === 'string' ? search.edit : undefined
  }),
  component: EditorialPage
})
