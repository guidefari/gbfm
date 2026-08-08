import { redirect } from '@tanstack/react-router'
import { Effect } from 'effect'
import { HttpApiError } from 'effect/unstable/httpapi'
import { getApiClient } from '@/lib/api-client'
import { redirectToLatestTweet } from './-latest'

export async function redirectToTweetLanding() {
  const client = await getApiClient()
  const session = await Effect.runPromise(client.navigation.getMicroPostNavigationSession())
  if (!session.slug) return redirectToLatestTweet()

  try {
    await Effect.runPromise(client.post.getMicroPostBySlug({ params: { slug: session.slug } }))
  } catch (error) {
    if (error instanceof HttpApiError.NotFound) return redirectToLatestTweet()
    throw error
  }

  throw redirect({ to: '/tweet/$slug', params: { slug: session.slug } })
}
