import { createFileRoute, Outlet } from '@tanstack/react-router'
import { notFoundHead } from '@/lib/seo'

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayoutRoute,
  head: () => notFoundHead('Dashboard', 'Your personal dashboard on goosebumps.fm')
})

function DashboardLayoutRoute() {
  return <Outlet />
}
