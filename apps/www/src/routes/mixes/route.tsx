import { createFileRoute, Outlet } from '@/lib/page'

export const Route = createFileRoute('/mixes')({
  component: () => <Outlet />
})
