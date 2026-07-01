import { createFileRoute } from '@tanstack/react-router'
import { signInRedirect } from '@/lib/route-guards'

export const Route = createFileRoute('/mix-upload')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw signInRedirect(location.href)
    }
  }
})
