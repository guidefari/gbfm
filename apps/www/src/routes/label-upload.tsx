import { createFileRoute, redirect } from '@tanstack/react-router'
import { signInRedirect } from '@/lib/route-guards'

export const Route = createFileRoute('/label-upload')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw signInRedirect(location.href)
    }
    if (context.auth.user?.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  }
})
