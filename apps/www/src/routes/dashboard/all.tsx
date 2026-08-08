import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/all')({
  beforeLoad: ({ location }) => {
    // Children nest under this path, so beforeLoad also runs for them. Redirecting
    // unconditionally would bounce the child back through this guard forever.
    if (location.pathname.replace(/\/$/, '') !== '/dashboard/all') return

    throw redirect({
      to: '/dashboard/all/mixes',
      search: { offset: 0, sort: 'created', order: 'desc' }
    })
  }
})
