import { createPageComponent } from '@/components/PageApp'
import { createFileRoute, redirect } from '@/lib/page'

export const Route = createFileRoute('/tweet/new')({
  loader: () => redirect({ to: '/new/tweet', search: { edit: undefined } })
})

export const Page = createPageComponent(Route)
