import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/labels')({
  component: () => <Outlet />
})
