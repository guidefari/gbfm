import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/tweet/')({
  loader: () => redirect({ to: '/tweets' })
})
