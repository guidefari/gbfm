import type { QueueTrackType } from '@gbfm/player'
import type { SelectAudio, SelectMdxCompiledAudio } from '@gbfm/vps/schemas'

export type PlayableAudio = Pick<SelectAudio, 'id' | 'title' | 'slug' | 'url' | 'type'> & {
  thumbnailUrl?: string | null
  creators?: SelectAudio['creators']
}

export const toQueueTrack = (audio: PlayableAudio): QueueTrackType => ({
  id: audio.id,
  title: audio.title,
  slug: audio.slug,
  url: audio.url,
  thumbnailUrl: audio.thumbnailUrl ?? null,
  type: audio.type,
  creators: audio.creators?.map((creator) => ({
    id: creator.id,
    name: creator.name,
    username: creator.username
  }))
})

export const toQueueTracks = (
  items: ReadonlyArray<SelectAudio | SelectMdxCompiledAudio>
): ReadonlyArray<QueueTrackType> => items.map(toQueueTrack)
