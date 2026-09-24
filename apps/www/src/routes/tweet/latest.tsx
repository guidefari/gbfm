import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { redirectToLatestTweet } from './-latest'

export const Route = createFileRoute('/tweet/latest')({
  loader: () => redirectToLatestTweet()
})

export const Page = createPageComponent(Route)
