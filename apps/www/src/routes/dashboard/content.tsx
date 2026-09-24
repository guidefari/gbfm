import { canCreatePosts } from '@gbfm/core/roles'
import { createPageComponent } from '@/components/PageApp'
import { createFileRoute, redirect } from '@/lib/page'

export const Route = createFileRoute('/dashboard/content')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/auth/sign-in', search: { redirect: location.href } })
    }
    if (!canCreatePosts(context.auth.user?.role)) {
      throw redirect({ to: '/dashboard' })
    }
    // Children nest under this path, so beforeLoad also runs for them. Redirecting
    // unconditionally would bounce the child back through this guard forever.
    if (location.pathname.replace(/\/$/, '') !== '/dashboard/content') return

    throw redirect({
      to: '/dashboard/content/mixes',
      search: { offset: 0, sort: 'created', order: 'desc' }
    })
  }
})

export const Page = createPageComponent(Route)
