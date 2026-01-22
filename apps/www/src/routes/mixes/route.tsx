import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/mixes')({
  component: () => <Outlet />
})
