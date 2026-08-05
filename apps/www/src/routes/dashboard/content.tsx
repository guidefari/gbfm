import { canCreatePosts } from '@gbfm/core/roles'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { signInRedirect } from '@/lib/route-guards'

export const Route = createFileRoute('/dashboard/content')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw signInRedirect(location.href)
    }
    if (!canCreatePosts(context.auth.user?.role)) {
      throw redirect({ to: '/dashboard' })
    }
    throw redirect({
      to: '/dashboard/content/mixes',
      search: { offset: 0, sort: 'created', order: 'desc' }
    })
  }
})
