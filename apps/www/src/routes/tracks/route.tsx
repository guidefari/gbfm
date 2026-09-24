import { createFileRoute, Outlet } from '@/lib/page'

export const Route = createFileRoute('/tracks')({
  component: TracksPage
})

function TracksPage() {
  return <Outlet />
}
