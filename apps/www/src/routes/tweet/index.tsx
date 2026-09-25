import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { redirectToTweetLanding } from './-landing'

export const Route = createFileRoute('/tweet/')({
  loader: () => redirectToTweetLanding()
})

export const Page = createPageComponent(Route)
