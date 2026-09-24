import { createFileRoute, Outlet } from '@/lib/page'

export const Route = createFileRoute('/labels')({
  component: () => <Outlet />
})
