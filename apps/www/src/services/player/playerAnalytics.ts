import { RuntimeClient } from '@/runtime'
import { track } from '@/services/analytics'
import { buildPausedProperties } from './playerAnalyticsHelpers'

const pageUrl = () => (typeof window !== 'undefined' ? window.location.pathname : '/')

const emit = (event: string, properties: Record<string, unknown>) => {
  void RuntimeClient.runPromise(track(event, properties)).catch(() => undefined)
}

export const trackAudioPlayed = (input: {
  readonly trackId: string
  readonly title: string
  readonly slug: string | null
}) =>
  emit('audio_played', {
    trackId: input.trackId,
    title: input.title,
    slug: input.slug,
    pageUrl: pageUrl()
  })

export const trackAudioPaused = (input: {
  readonly trackId: string | null
  readonly title: string
  readonly currentTime: number
  readonly duration: number
}) => emit('audio_paused', buildPausedProperties(input))

export const trackAudioCompleted = (input: {
  readonly trackId: string | null
  readonly title: string
  readonly duration: number
}) =>
  emit('audio_completed', {
    trackId: input.trackId,
    title: input.title,
    duration: input.duration
  })

export const trackAudioSeek = (input: {
  readonly trackId: string | null
  readonly fromTime: number
  readonly toTime: number
  readonly method: 'scrub' | 'keyboard' | 'mediasession'
}) => emit('audio_seek', input)

export const trackAudioQueueAction = (input: {
  readonly action: 'add' | 'remove' | 'reorder' | 'clear' | 'play_from'
  readonly trackId?: string
  readonly queueLength: number
}) => emit('audio_queue_action', input)

export const trackAudioError = (input: {
  readonly trackId: string | null
  readonly title: string
  readonly errorMessage: string
}) => emit('audio_error', input)

export { buildPausedProperties } from './playerAnalyticsHelpers'
