import { getPublicJson, record, records, text } from '@/lib/server/public/content'
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
      quote: null
    }
  }
  const value = record(screen.value)
  if (!value) {
    return {
      item: null,
      failure: 'Content is unavailable right now.',
      replies: [],
      parent: null,
      quote: null
    }
  }
  const item = record(value.post)
  const musicType = text(item?.musicEntityType)
  const musicId = text(item?.musicEntityId)
  const musicPath =
    musicType === 'album'
      ? 'albums'
      : musicType === 'track'
        ? 'tracks'
        : musicType === 'playlist'
          ? 'playlists'
          : null
  const [musicEntity, musicLinks] =
    musicPath && musicId
      ? await Promise.all([
          getPublicJson(event, `/api/music/${musicPath}/${encodeURIComponent(musicId)}`),
          getPublicJson(
            event,
            `/api/music/${encodeURIComponent(musicType)}/${encodeURIComponent(musicId)}/links?status=verified`
          )
        ])
      : [null, null]
  return {
    item,
    failure: null,
    replies: records(value.replies),
    parent: record(value.root),
    quote: record(value.quote),
    musicEntity: musicEntity?.ok ? record(musicEntity.value) : null,
    musicLinks: musicLinks?.ok ? records(musicLinks.value) : []
  }
}) satisfies PageServerLoad
