export type AudioEventName =
  | 'audio_played'
  | 'audio_paused'
  | 'audio_completed'
  | 'audio_abandoned'
  | 'audio_seek'
  | 'audio_queue_action'
  | 'audio_error'

export interface AudioPlayedProperties {
  trackId: string | null
  title: string
  slug: string | null
  pageUrl: string | null
}

export interface AudioPausedProperties {
  trackId: string | null
  title: string
  progressPercent: number
  currentTime: number
}

export interface AudioCompletedProperties {
  trackId: string | null
  title: string
  duration: number
}

export interface AudioAbandonedProperties {
  trackId: string | null
  title: string
  progressPercent: number
  currentTime: number
  duration: number
}

export interface AudioSeekProperties {
  trackId: string | null
  fromTime: number
  toTime: number
  method: 'scrub' | 'keyboard' | 'mediasession'
}

export interface AudioQueueActionProperties {
  action: 'add' | 'remove' | 'reorder' | 'clear' | 'play_from'
  trackId?: string
  queueLength: number
}

export interface AudioErrorProperties {
  trackId: string | null
  title: string
  errorMessage: string
}

export type AudioEventProperties =
  | AudioPlayedProperties
  | AudioPausedProperties
  | AudioCompletedProperties
  | AudioAbandonedProperties
  | AudioSeekProperties
  | AudioQueueActionProperties
  | AudioErrorProperties
