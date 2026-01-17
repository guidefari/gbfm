import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/profile')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
  component: () => null
})
