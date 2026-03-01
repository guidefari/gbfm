import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/tweet')({
  component: TweetPage
})

function TweetPage() {
  return <Outlet />
}
