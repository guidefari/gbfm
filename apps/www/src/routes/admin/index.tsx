import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated || context.auth.user?.role !== 'admin') {
      throw redirect({
        to: '/'
      })
    }
  },
  component: RouteComponent
})

function RouteComponent() {
  return <div>Hello "/admin/"!</div>
}
