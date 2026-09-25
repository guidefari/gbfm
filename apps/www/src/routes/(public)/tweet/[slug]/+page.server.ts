import { NavigationResultResponse } from '@gbfm/api/navigation'
import { Option, Schema } from 'effect'
import { getPublicJson, record, records } from '@/lib/server/public/content'
import { apiRequest } from '@/lib/server/api/api-gateway'
import type { PageServerLoad } from './$types'
export const load = (async (event) => {
  const slug = encodeURIComponent(event.params.slug)
  const screen = await getPublicJson(event, `/api/content/posts/micro/${slug}/screen`)
  if (!screen.ok) {
    return {
      item: null,
      failure: screen.message,
      replies: [],
      parent: null,
      quote: null,
      navigation: null
    }
  }
  const value = record(screen.value)
  if (!value) {
    return {
      item: null,
      failure: 'Content is unavailable right now.',
      replies: [],
      parent: null,
      quote: null,
      navigation: null
    }
  }
  const item = record(value.post)
  const navigationResponse = item
    ? await apiRequest(event, '/api/content/posts/micro/navigate/peek', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          command: { _tag: 'Open', slug: event.params.slug },
          from: event.params.slug
        })
      }).catch(() => null)
    : null
  const navigationInput: unknown = navigationResponse?.ok
    ? await navigationResponse.json().catch(() => null)
    : null
  const navigation = Option.getOrNull(
    Schema.decodeUnknownOption(NavigationResultResponse)(navigationInput)
  )
  return {
    item,
    failure: null,
    replies: records(value.replies),
    parent: record(value.root),
    quote: record(value.quote),
    navigation
  }
}) satisfies PageServerLoad
