import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/dispatch')({
  component: () => <Outlet />
})
