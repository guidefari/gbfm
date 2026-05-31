import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/label-upload')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/auth/sign-in' })
    }
    if (context.auth.user?.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  }
})
