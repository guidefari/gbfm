import { createFileRoute, Outlet } from '@/lib/page'

export const Route = createFileRoute('/editorial')({
  component: () => <Outlet />
})
