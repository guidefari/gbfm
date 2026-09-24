import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { redirectToTweetLanding } from './tweet/-landing'

export const Route = createFileRoute('/tweets')({
  loader: () => redirectToTweetLanding()
})

export const Page = createPageComponent(Route)
