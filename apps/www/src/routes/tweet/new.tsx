import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/tweet/new')({
  loader: () => redirect({ to: '/new/tweet', search: { edit: undefined } })
})
