import { createFileRoute } from '@tanstack/react-router'
import { redirectToTweetLanding } from './tweet/-landing'

export const Route = createFileRoute('/tweets')({
  loader: () => redirectToTweetLanding()
})
