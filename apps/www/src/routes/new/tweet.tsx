'use client'

import { createFileRoute } from '@tanstack/react-router'
import { TweetCapturePage } from './-TweetCapturePage'

export const Route = createFileRoute('/new/tweet')({
  validateSearch: (search) => ({
    edit: typeof search.edit === 'string' ? search.edit : undefined
  }),
  component: TweetCapturePage
})
