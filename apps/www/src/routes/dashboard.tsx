import { createFileRoute, Outlet } from '@tanstack/react-router'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayoutRoute,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.dashboard)
  })
})

function DashboardLayoutRoute() {
  return <Outlet />
}
