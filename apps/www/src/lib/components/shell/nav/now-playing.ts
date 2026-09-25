import type { PlayerSnapshot } from '@/lib/player/player'

export type NowPlaying = {
  readonly id: string
  readonly playing: boolean
  readonly title: string
  readonly thumbnailUrl: string | null
  readonly progress: number
}

export const toNowPlaying = (snapshot: PlayerSnapshot | null): NowPlaying | null => {
  const track = snapshot?.queue.tracks[snapshot.queue.currentIndex]

  if (!snapshot || !track) return null

  return {
    id: track.id,
    playing: snapshot.playing,
    title: track.title,
    thumbnailUrl: track.thumbnailUrl ?? null,
    progress: snapshot.duration
      ? Math.min(100, (snapshot.currentTime / snapshot.duration) * 100)
      : 0,
  }
}
