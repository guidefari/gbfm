import { Effect, Exit, Redacted } from 'effect'
import { useEffect, useState } from 'react'

import { getHttpClient } from '@/api/client'
import { loadTweetBrowse, type TweetBrowseData } from '@/api/tweetReader'
import { env } from '@/env'
import { useAuthStore } from '@/store/auth'

export function useTweetBrowse(from: string | null, month: string | null, page: number) {
  const token = useAuthStore((auth) => auth.sessionToken)
  const account = useAuthStore((auth) => auth.user?.id ?? 'anonymous')
  const [revision, setRevision] = useState(0)
  const key = `${account}:${from}:${month}:${page}:${revision}`

  const [result, setResult] = useState<{
    readonly status: 'loading' | 'ready' | 'error'
    readonly data: TweetBrowseData | null
    readonly key: string
  }>({ key: '', status: 'loading', data: null })

  useEffect(() => {
    const controller = new AbortController()

    const work = getHttpClient.pipe(
      Effect.flatMap((httpClient) =>
        loadTweetBrowse(
          {
            httpClient,
            baseUrl: env.EXPO_PUBLIC_API_URL,
            sessionToken: token ? Redacted.make(token) : null,
          },
          from,
          month,
          page,
        ),
      ),
      Effect.timeout('15 seconds'),
    )

    void Effect.runPromiseExit(work, { signal: controller.signal }).then((exit) => {
      if (controller.signal.aborted) return
      setResult(
        Exit.isSuccess(exit)
          ? { key, status: 'ready', data: exit.value }
          : { key, status: 'error', data: null },
      )
    })

    return () => controller.abort()
  }, [from, month, page, token, key])

  const status = result.key === key ? result.status : 'loading'
  const data = result.key === key ? result.data : null

  return { status, data, refresh: () => setRevision((value) => value + 1) }
}
