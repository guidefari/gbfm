import { createFileRoute, Outlet } from '@/lib/page'

export const Route = createFileRoute('/tweet')({
  component: TweetPage
})

function TweetPage() {
  return <Outlet />
}
