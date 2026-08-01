import { createFileRoute, redirect } from '@tanstack/react-router'
import { Effect } from 'effect'
import { getApiClient } from '@/lib/api-client'
import { captureException } from '@/services/analytics'

export const Route = createFileRoute('/tweet/')({
  loader: async () => {
    const client = await getApiClient()
    const result = await Effect.runPromise(
      client.post
        .getMicroPosts({ query: { limit: 1, offset: 0 } })
        .pipe(
          Effect.tapError((error) => captureException(error, { endpoint: 'post.getMicroPosts' }))
        )
    )

    const latest = result.data[0]
    if (!latest) {
      throw redirect({ to: '/' })
    }

    throw redirect({ to: '/tweet/$slug', params: { slug: latest.slug } })
  }
})
