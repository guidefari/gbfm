import { createPageComponent } from '@/components/PageApp'
import { createFileRoute, redirect } from '@/lib/page'

export const Route = createFileRoute('/mixes/')({
  beforeLoad: () => {
    throw redirect({ to: '/', replace: true })
  }
})

export const Page = createPageComponent(Route)
