import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/mix-upload')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/auth/sign-in' })
    }
  }
})
