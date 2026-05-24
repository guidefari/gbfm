import type { SelectAudio, SelectMdxCompiledAudio } from '@gbfm/vps/schemas'
import type { Creator } from './types'

export interface NowPlayingContext {
  url: string
  title: string
  slug?: string
  creators?: Creator[]
}

export interface QueueItem {
  queueId: string
  id: string
  title: string
  url: string
  thumbnailUrl: string
  slug?: string
  addedAt: number
  creators?: Creator[]
}

export interface PlayerState {
  isPlaying: boolean
  progress: number
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  audioSrc: string | null
  thumbnailUrl: string
  nowPlayingContext: NowPlayingContext
  currentTrackId: string | null
  queue: QueueItem[]
  currentIndex: number
  isQueueVisible: boolean
  isFullscreenVisible: boolean
  isInitialized: boolean
}

export type PlayerAction =
  | { type: 'PLAY'; title?: string; pageUrl: string }
  | { type: 'PAUSE' }
  | {
      type: 'LOAD_TRACK'
      src: string
      thumbnailUrl: string
      title: string
      trackId?: string
      creators?: Creator[]
      slug?: string
      pageUrl: string
    }
  | {
      type: 'PRELOAD_TRACK'
      src: string
      thumbnailUrl: string
      title: string
      trackId?: string
      creators?: Creator[]
      slug?: string
      pageUrl: string
    }
  | { type: 'UPDATE_PROGRESS'; currentTime: number; duration: number }
  | { type: 'UPDATE_PLAYING_STATE'; playing: boolean }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'SET_TIME'; percentage: number; duration: number }
  | { type: 'ADD_TO_QUEUE'; mix: SelectAudio | SelectMdxCompiledAudio }
  | { type: 'REMOVE_FROM_QUEUE'; queueId: string }
  | { type: 'CLEAR_QUEUE' }
  | { type: 'REORDER_QUEUE'; fromIndex: number; toIndex: number }
  | { type: 'SET_CURRENT_INDEX'; index: number }
  | { type: 'TOGGLE_QUEUE' }
  | { type: 'TOGGLE_FULLSCREEN' }
  | { type: 'CLOSE_FULLSCREEN' }
  | { type: 'SET_INITIALIZED' }
  | { type: 'TRACK_ENDED' }

export const defaultNowPlayingContext: NowPlayingContext = {
  url: '/',
  title: 'Nothing playing, yet'
}

export const initialPlayerState: PlayerState = {
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
  volume: 100,
  isMuted: false,
  audioSrc: null,
  thumbnailUrl: '',
  nowPlayingContext: defaultNowPlayingContext,
  currentTrackId: null,
  queue: [],
  currentIndex: -1,
  isQueueVisible: false,
  isFullscreenVisible: false,
  isInitialized: false
}

export function playerReducer(
  state: PlayerState,
  action: PlayerAction
): PlayerState {
  switch (action.type) {
    case 'PLAY':
      return {
        ...state,
        isPlaying: true,
        nowPlayingContext: action.title
          ? {
              ...state.nowPlayingContext,
              title: action.title,
              url: action.pageUrl
            }
          : state.nowPlayingContext
      }

    case 'PAUSE':
      return { ...state, isPlaying: false }

    case 'LOAD_TRACK':
      return {
        ...state,
        audioSrc: action.src,
        thumbnailUrl: action.thumbnailUrl,
        nowPlayingContext: {
          title: action.title,
          url: action.pageUrl,
          slug: action.slug,
          creators: action.creators
        },
        currentTrackId: action.trackId ?? null,
        currentTime: 0,
        progress: 0,
        isPlaying: true
      }

    case 'PRELOAD_TRACK':
      return {
        ...state,
        audioSrc: action.src,
        thumbnailUrl: action.thumbnailUrl,
        nowPlayingContext: {
          title: action.title,
          url: action.pageUrl,
          slug: action.slug,
          creators: action.creators
        },
        currentTrackId: action.trackId ?? null,
        currentTime: 0,
        progress: 0
      }

    case 'UPDATE_PROGRESS': {
      const progress = (action.currentTime / action.duration) * 100 || 0
      return {
        ...state,
        progress,
        currentTime: action.currentTime,
        duration: action.duration
      }
    }

    case 'UPDATE_PLAYING_STATE':
      return { ...state, isPlaying: action.playing }

    case 'SET_VOLUME': {
      const volume = Math.max(0, Math.min(100, action.volume))
      return { ...state, volume, isMuted: volume === 0 }
    }

    case 'TOGGLE_MUTE':
      return { ...state, isMuted: !state.isMuted }

    case 'SET_TIME': {
      const newTime = (action.percentage / 100) * action.duration
      return { ...state, progress: action.percentage, currentTime: newTime }
    }

    case 'ADD_TO_QUEUE': {
      const mix = action.mix
      const item: QueueItem = {
        queueId: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        id: mix.id,
        title: mix.title,
        url: mix.url,
        thumbnailUrl: mix.thumbnailUrl || '',
        slug: mix.slug,
        addedAt: Date.now(),
        creators: 'creators' in mix ? mix.creators : undefined
      }
      return { ...state, queue: [...state.queue, item] }
    }

    case 'REMOVE_FROM_QUEUE': {
      const removedIndex = state.queue.findIndex(
        (item) => item.queueId === action.queueId
      )
      const newQueue = state.queue.filter(
        (item) => item.queueId !== action.queueId
      )
      let newCurrentIndex = state.currentIndex
      if (removedIndex !== -1 && removedIndex <= state.currentIndex) {
        newCurrentIndex = Math.max(-1, state.currentIndex - 1)
      }
      return {
        ...state,
        queue: newQueue,
        currentIndex: newCurrentIndex >= newQueue.length ? -1 : newCurrentIndex
      }
    }

    case 'CLEAR_QUEUE':
      return { ...state, queue: [], currentIndex: -1 }

    case 'REORDER_QUEUE': {
      const newQueue = [...state.queue]
      const [moved] = newQueue.splice(action.fromIndex, 1)
      newQueue.splice(action.toIndex, 0, moved)
      let newCurrentIndex = state.currentIndex
      if (action.fromIndex === state.currentIndex) {
        newCurrentIndex = action.toIndex
      } else if (
        action.fromIndex < state.currentIndex &&
        action.toIndex >= state.currentIndex
      ) {
        newCurrentIndex = state.currentIndex - 1
      } else if (
        action.fromIndex > state.currentIndex &&
        action.toIndex <= state.currentIndex
      ) {
        newCurrentIndex = state.currentIndex + 1
      }
      return { ...state, queue: newQueue, currentIndex: newCurrentIndex }
    }

    case 'SET_CURRENT_INDEX':
      return { ...state, currentIndex: action.index }

    case 'TOGGLE_QUEUE':
      return { ...state, isQueueVisible: !state.isQueueVisible }

    case 'TOGGLE_FULLSCREEN':
      return { ...state, isFullscreenVisible: !state.isFullscreenVisible }

    case 'CLOSE_FULLSCREEN':
      return { ...state, isFullscreenVisible: false }

    case 'SET_INITIALIZED':
      return { ...state, isInitialized: true }

    case 'TRACK_ENDED':
      return { ...state, isPlaying: false }

    default:
      return state
  }
}
