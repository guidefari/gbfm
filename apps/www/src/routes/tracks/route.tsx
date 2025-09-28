import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/tracks')({
  component: TracksPage
})

function TracksPage() {
  return <Outlet />
}
