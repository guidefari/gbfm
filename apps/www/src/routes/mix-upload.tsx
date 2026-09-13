import { createFileRoute } from '@tanstack/react-router'
import { signInRedirect } from '@/lib/route-guards'
import { privateHead } from '@/lib/seo'

export const Route = createFileRoute('/mix-upload')({
  head: () => privateHead('Upload a mix'),
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw signInRedirect(location.href)
    }
  }
})
