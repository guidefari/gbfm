import type { QueueTrackType } from '@gbfm/player'

export type ActiveSource =
  | { readonly _tag: 'none' }
  | { readonly _tag: 'queue'; readonly track: QueueTrackType }
  | { readonly _tag: 'preview'; readonly src: string }

export const noneSource: ActiveSource = { _tag: 'none' }

export const queueSource = (track: QueueTrackType): ActiveSource => ({
  _tag: 'queue',
  track
})

export const previewSource = (src: string): ActiveSource => ({
  _tag: 'preview',
  src
})

export const isQueueSource = (
  source: ActiveSource
): source is Extract<ActiveSource, { readonly _tag: 'queue' }> => source._tag === 'queue'

export const isPreviewSource = (
  source: ActiveSource
): source is Extract<ActiveSource, { readonly _tag: 'preview' }> => source._tag === 'preview'

/** Whether transport controls should target the shared HTML audio element
 *  directly (preview) rather than the queue-backed player core. */
export const routesTransportToElement = (source: ActiveSource): boolean => source._tag === 'preview'

/** Whether the bottom/fullscreen player chrome should render for this source. */
export const showsPlayerChrome = (source: ActiveSource): boolean => source._tag === 'queue'

/** Queue track currently driving playback, if any. Previews intentionally
 *  return null so UI does not present a stale queue selection as audible. */
export const activeQueueTrack = (source: ActiveSource): QueueTrackType | null =>
  source._tag === 'queue' ? source.track : null

/** True when the given queue track is the active audible source. */
export const isActiveQueueTrack = (source: ActiveSource, trackId: string): boolean =>
  source._tag === 'queue' && source.track.id === trackId

/** True when the given preview URL is the active audible source. */
export const isActivePreview = (source: ActiveSource, src: string): boolean =>
  source._tag === 'preview' && source.src === src

/**
 * Decides how a playTrack request should bind audio when a queue selection
 * may already exist and a preview may be active.
 */
export type PlayTrackBinding =
  | { readonly _tag: 'playExistingSession'; readonly trackId: string }
  | { readonly _tag: 'rebindQueueSession'; readonly track: QueueTrackType }
  | { readonly _tag: 'startNewQueueSession'; readonly track: QueueTrackType }

export const resolvePlayTrackBinding = (input: {
  readonly active: ActiveSource
  readonly selectedQueueTrack: QueueTrackType | null
  readonly track: QueueTrackType
}): PlayTrackBinding => {
  const { active, selectedQueueTrack, track } = input

  if (selectedQueueTrack?.id === track.id && active._tag === 'queue') {
    return { _tag: 'playExistingSession', trackId: track.id }
  }

  if (selectedQueueTrack?.id === track.id) {
    return { _tag: 'rebindQueueSession', track }
  }

  return { _tag: 'startNewQueueSession', track }
}
