import { redirect } from '@tanstack/react-router'
import { Effect } from 'effect'
import { getApiClient } from '@/lib/api-client'
import { redirectToLatestTweet } from './-latest'

export async function redirectToTweetLanding() {
  const client = await getApiClient()
  const session = await Effect.runPromise(client.navigation.getMicroPostNavigationSession())
  if (!session.slug) return redirectToLatestTweet()

  throw redirect({ to: '/tweet/$slug', params: { slug: session.slug } })
}
