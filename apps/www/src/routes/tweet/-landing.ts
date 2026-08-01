import { redirect } from '@tanstack/react-router'
import { Effect } from 'effect'
import { getApiClient } from '@/lib/api-client'
import { isNotFoundError } from '@/lib/http-errors'
import { captureException } from '@/services/analytics'
import { readTweetBrowseState } from '@/store/tweetSeen'
import { redirectToLatestTweet } from './-latest'

export async function redirectToTweetLanding() {
  const resume = readTweetBrowseState().lastViewed
  if (resume) {
    try {
      const client = await getApiClient()
      const post = await Effect.runPromise(
        client.post
          .getMicroPostBySlug({ params: { slug: resume.slug } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'post.getMicroPostBySlug' })
            )
          )
      )

      throw redirect({ to: '/tweet/$slug', params: { slug: post.slug } })
    } catch (error) {
      if (!isNotFoundError(error)) throw error
    }
  }

  return redirectToLatestTweet()
}
