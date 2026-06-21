import type { NowPlayingContext, PlayerAction, QueueItem } from './machine'
import type { Creator } from './types'

export type QueueableAudio = {
  id: string
  title: string
  url: string
  thumbnailUrl: string | null
  slug?: string
  creators?: Creator[]
}

type LoadTrackSnapshot = {
  audioSrc: string | null
  isPlaying: boolean
  currentTime: number
  currentTrackId: string | null
}

type LoadTrackRequest = {
  src: string
  thumbnailUrl: string
  title: string
  trackId?: string
  creators?: Creator[]
  slug?: string
}

type LoadTrackAction = Extract<PlayerAction, { type: 'LOAD_TRACK' }>
type SetTimeAction = Extract<PlayerAction, { type: 'SET_TIME' }>
type UpdateProgressAction = Extract<PlayerAction, { type: 'UPDATE_PROGRESS' }>

type PauseEffects = {
  playbackState: 'paused'
  persistPosition:
    | {
        trackId: string
        time: number
      }
    | undefined
  pausedEvent: {
    trackId: string | null
    title: string
    progressPercent: number
    currentTime: number
  }
}

export type LoadTrackDecision =
  | { type: 'no-preview' }
  | { type: 'resume-current'; title: string }
  | { type: 'pause-current' }
  | {
      type: 'load-new'
      src: string
      action: LoadTrackAction
      metadata: {
        title: string
        artists: string[]
        artwork: string
      }
      playedEvent: {
        trackId: string | null
        title: string
        slug: string | null
        pageUrl: string
      }
      persistPreviousPosition?: {
        trackId: string
        time: number
      }
    }

export function resolveLoadTrack(
  snapshot: LoadTrackSnapshot,
  request: LoadTrackRequest,
  pageUrl: string
): LoadTrackDecision {
  if (!request.src) {
    return { type: 'no-preview' }
  }

  if (request.src === snapshot.audioSrc && !snapshot.isPlaying) {
    return { type: 'resume-current', title: request.title }
  }

  if (request.src === snapshot.audioSrc && snapshot.isPlaying) {
    return { type: 'pause-current' }
  }

  return {
    type: 'load-new',
    src: request.src,
    action: {
      type: 'LOAD_TRACK',
      src: request.src,
      thumbnailUrl: request.thumbnailUrl,
      title: request.title,
      trackId: request.trackId,
      creators: request.creators,
      slug: request.slug,
      pageUrl
    },
    metadata: {
      title: request.title,
      artists: request.creators?.map((creator) => creator.name) ?? [],
      artwork: request.thumbnailUrl
    },
    playedEvent: {
      trackId: request.trackId ?? null,
      title: request.title,
      slug: request.slug ?? null,
      pageUrl
    },
    persistPreviousPosition:
      snapshot.currentTrackId && snapshot.currentTime > 0
        ? { trackId: snapshot.currentTrackId, time: snapshot.currentTime }
        : undefined
  }
}

export function resolvePauseEffects({
  currentTime,
  currentTrackId,
  nowPlayingContext,
  progress
}: {
  currentTime: number
  currentTrackId: string | null
  nowPlayingContext: NowPlayingContext
  progress: number
}): PauseEffects {
  return {
    playbackState: 'paused',
    persistPosition:
      currentTime > 0 && currentTrackId
        ? { trackId: currentTrackId, time: currentTime }
        : undefined,
    pausedEvent: {
      trackId: currentTrackId,
      title: nowPlayingContext.title,
      progressPercent: progress,
      currentTime
    }
  }
}

export function resolveRelativeSeek({
  fromTime,
  deltaSeconds,
  trackId,
  method
}: {
  fromTime: number
  deltaSeconds: number
  trackId: string | null
  method: 'keyboard'
}) {
  const toTime = fromTime + deltaSeconds

  return {
    toTime,
    seekEvent: {
      trackId,
      fromTime,
      toTime,
      method
    }
  }
}

export function resolvePercentageSeek({
  percentage,
  duration,
  fromTime,
  trackId
}: {
  percentage: number
  duration: number
  fromTime: number
  trackId: string | null
}) {
  const toTime = (percentage / 100) * duration
  const action: SetTimeAction = { type: 'SET_TIME', percentage, duration }

  return {
    toTime,
    action,
    seekEvent: {
      trackId,
      fromTime,
      toTime,
      method: 'scrub'
    }
  }
}

export function resolveProgressUpdate({
  currentTime,
  duration,
  currentTrackId,
  now,
  lastPersistTime,
  persistInterval
}: {
  currentTime: number
  duration: number
  currentTrackId: string | null
  now: number
  lastPersistTime: number
  persistInterval: number
}) {
  const shouldPersist = now - lastPersistTime >= persistInterval
  const action: UpdateProgressAction = { type: 'UPDATE_PROGRESS', currentTime, duration }

  return {
    action,
    nextLastPersistTime: shouldPersist ? now : lastPersistTime,
    persistPosition:
      shouldPersist && currentTrackId ? { trackId: currentTrackId, time: currentTime } : undefined,
    positionState: shouldPersist && currentTrackId ? { duration, position: currentTime } : undefined
  }
}

export function createQueueItem({
  mix,
  queueIdTime,
  addedAt,
  idSuffix
}: {
  mix: QueueableAudio
  queueIdTime: number
  addedAt: number
  idSuffix: string
}): QueueItem {
  return {
    queueId: `queue-${queueIdTime}-${idSuffix}`,
    id: mix.id,
    title: mix.title,
    url: mix.url,
    thumbnailUrl: mix.thumbnailUrl || '',
    slug: mix.slug,
    addedAt,
    creators: mix.creators
  }
}
