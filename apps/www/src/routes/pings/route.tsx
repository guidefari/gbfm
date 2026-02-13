import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/pings')({
  component: PingsPage
})

function PingsPage() {
  return <Outlet />
}
