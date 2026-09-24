import { createPageComponent } from '@/components/PageApp'
import { createFileRoute, redirect } from '@/lib/page'

export const Route = createFileRoute('/tweet/')({
  loader: () => redirect({ to: '/tweets' })
})

export const Page = createPageComponent(Route)
