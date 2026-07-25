export const resolveProgress = (currentTime: number, duration: number) =>
  duration > 0 && Number.isFinite(duration) ? (currentTime / duration) * 100 : 0

export const resolveSeekTarget = (percentage: number, duration: number) => {
  if (!Number.isFinite(duration) || duration <= 0) return 0
  const clamped = Math.max(0, Math.min(100, percentage))
  return (clamped / 100) * duration
}

export const resolveRelativeSeek = (currentTime: number, delta: number, duration: number) => {
  const target = currentTime + delta
  if (target < 0) return 0
  if (Number.isFinite(duration) && duration > 0 && target > duration) return duration
  return target
}

export const resolveVolume = (volume: number, isMuted: boolean) =>
  isMuted ? 0 : Math.max(0, Math.min(100, volume)) / 100

export type NextIndexInput = {
  readonly trackCount: number
  readonly currentIndex: number
}

export const resolveNextIndex = ({ trackCount, currentIndex }: NextIndexInput): number | null => {
  if (trackCount === 0 || currentIndex < 0) return null
  const next = currentIndex + 1
  return next < trackCount ? next : null
}

export const resolvePreviousIndex = ({
  trackCount,
  currentIndex
}: NextIndexInput): number | null => {
  if (trackCount === 0) return null
  return currentIndex <= 0 ? trackCount - 1 : currentIndex - 1
}

export type LoadDecision =
  | { readonly _tag: 'skip' }
  | { readonly _tag: 'resume' }
  | { readonly _tag: 'load'; readonly restoreFrom: number | null }

export const resolveTrackLoad = ({
  loadedTrackId,
  nextTrackId,
  autoplay,
  savedPosition
}: {
  readonly loadedTrackId: string | null
  readonly nextTrackId: string
  readonly autoplay: boolean
  readonly savedPosition: number | null
}): LoadDecision => {
  if (loadedTrackId === nextTrackId) return autoplay ? { _tag: 'resume' } : { _tag: 'skip' }
  return {
    _tag: 'load',
    restoreFrom: savedPosition !== null && savedPosition > 0 ? savedPosition : null
  }
}
