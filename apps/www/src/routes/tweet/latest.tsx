import { createFileRoute } from '@tanstack/react-router'
import { redirectToLatestTweet } from './-latest'

export const Route = createFileRoute('/tweet/latest')({
  loader: () => redirectToLatestTweet()
})
