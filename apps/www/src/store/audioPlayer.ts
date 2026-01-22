import type { SelectAudio } from '@gbfm/vps/schemas'
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

let lastPersistTime = 0
const PERSIST_INTERVAL = 5000

const persistTimeToStorage = (time: number) => {
  try {
    const stored = localStorage.getItem('audio-player-store')
    if (stored) {
      const parsed = JSON.parse(stored)
      parsed.state.currentTime = time
      localStorage.setItem('audio-player-store', JSON.stringify(parsed))
    }
  } catch {
    // Ignore storage errors
  }
}

interface NowPlayingContext {
  url: string
  title: string
}

interface QueueItem {
  queueId: string // Unique queue entry ID
  id: string // Original track ID
  title: string
  url: string
  thumbnailUrl: string
  addedAt: number
}

interface AudioPlayerState {
  // Audio element ref (not persisted)
  audioRef: HTMLAudioElement | null

  // Playback state
  isPlaying: boolean
  progress: number
  currentTime: number
  duration: number

  // Volume state (persisted)
  volume: number // 0-100
  isMuted: boolean

  // Track info (persisted)
  audioSrc: string | null
  thumbnailUrl: string
  nowPlayingContext: NowPlayingContext
  currentTrackId: string | null

  // Queue state (persisted)
  queue: QueueItem[]
  currentIndex: number
  isQueueVisible: boolean

  // State management
  isInitialized: boolean
  isFullscreenVisible: boolean
}

interface AudioPlayerActions {
  // Audio ref management
  setAudioRef: (ref: HTMLAudioElement | null) => void

  // Playback controls
  play: (title?: string) => void
  pause: () => void
  togglePlayPause: () => void
  jumpForward: (seconds?: number) => void
  jumpBackward: (seconds?: number) => void
  setTimeUsingPercentage: (percentage: number) => void

  // Volume controls
  setVolume: (volume: number) => void
  toggleMute: () => void

  // Track management
  loadTrack: (
    src: string,
    thumbnailUrl: string,
    title: string,
    trackId?: string
  ) => void

  // Queue management
  addToQueue: (mix: SelectAudio) => void
  removeFromQueue: (itemId: string) => void
  clearQueue: () => void
  reorderQueue: (fromIndex: number, toIndex: number) => void
  playFromQueue: (index: number) => void
  playNext: () => void
  playPrevious: () => void
  toggleQueue: () => void
  toggleFullscreen: () => void
  closeFullscreen: () => void

  // State updates (called by audio events)
  updateProgress: () => void
  updatePlayingState: (playing: boolean) => void
  updateNowPlaying: (context: Partial<NowPlayingContext>) => void

  // Initialization
  initialize: () => void
}

type AudioPlayerStore = AudioPlayerState & AudioPlayerActions

const defaultNowPlayingContext: NowPlayingContext = {
  url: '/',
  title: 'Nothing playing, yet'
}

export const useAudioPlayerStore = create<AudioPlayerStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        audioRef: null,
        isPlaying: false,
        progress: 0,
        currentTime: 0,
        duration: 0,
        volume: 100, // Default to 100%
        isMuted: false,
        audioSrc: null,
        thumbnailUrl: '',
        nowPlayingContext: defaultNowPlayingContext,
        currentTrackId: null,

        // Queue state
        queue: [],
        currentIndex: -1,
        isQueueVisible: false,

        isInitialized: false,
        isFullscreenVisible: false,

        // Actions
        setAudioRef: (ref) => {
          set({ audioRef: ref }, false, 'audioPlayer/setAudioRef')

          if (ref) {
            ref.onended = () => {
              const { queue, currentIndex } = get()

              if (queue.length > 0 && currentIndex < queue.length - 1) {
                get().playNext()
              } else {
                get().pause()
              }
            }

            ref.ontimeupdate = () => {
              get().updateProgress()
            }

            ref.onloadedmetadata = () => {
              set(
                { duration: ref.duration || 0 },
                false,
                'audioPlayer/updateDuration'
              )
            }

            const handleVisibilityChange = () => {
              if (document.hidden) {
                const { currentTime } = get()
                if (currentTime > 0) {
                  persistTimeToStorage(currentTime)
                  lastPersistTime = Date.now()
                }
              }
            }

            document.addEventListener(
              'visibilitychange',
              handleVisibilityChange
            )

            if (!get().isInitialized) {
              get().initialize()
            }
          }
        },

        play: (title) => {
          const { audioRef, nowPlayingContext } = get()
          if (!audioRef) return

          audioRef.play()
          set({ isPlaying: true }, false, 'audioPlayer/play')

          if (title) {
            set(
              {
                nowPlayingContext: {
                  ...nowPlayingContext,
                  title,
                  url:
                    typeof window !== 'undefined'
                      ? window.location.pathname
                      : '/'
                }
              },
              false,
              'audioPlayer/updateNowPlaying'
            )
          }
        },

        pause: () => {
          const { audioRef, currentTime } = get()
          if (!audioRef) return

          audioRef.pause()
          set({ isPlaying: false }, false, 'audioPlayer/pause')
          if (currentTime > 0) {
            persistTimeToStorage(currentTime)
            lastPersistTime = Date.now()
          }
        },

        togglePlayPause: () => {
          const { isPlaying } = get()
          if (isPlaying) {
            get().pause()
          } else {
            get().play()
          }
        },

        jumpForward: (seconds = 30) => {
          const { audioRef } = get()
          if (!audioRef || !audioRef.src) return

          audioRef.currentTime += seconds
        },

        jumpBackward: (seconds = 15) => {
          const { audioRef } = get()
          if (!audioRef || !audioRef.src) return

          audioRef.currentTime -= seconds
        },

        setTimeUsingPercentage: (percentage) => {
          const { audioRef } = get()
          if (!audioRef) return

          const newTime = (percentage / 100) * audioRef.duration
          audioRef.currentTime = newTime
          set(
            {
              progress: percentage,
              currentTime: newTime
            },
            false,
            'audioPlayer/setTime'
          )
        },

        setVolume: (volume) => {
          const { audioRef } = get()
          if (!audioRef) return

          // Clamp volume between 0 and 100
          const clampedVolume = Math.max(0, Math.min(100, volume))

          // Set HTML audio volume (0-1 range)
          audioRef.volume = clampedVolume / 100

          // Update state
          set(
            {
              volume: clampedVolume,
              isMuted: clampedVolume === 0
            },
            false,
            'audioPlayer/setVolume'
          )
        },

        toggleMute: () => {
          const { audioRef, isMuted, volume } = get()
          if (!audioRef) return

          if (isMuted) {
            // Unmute: restore previous volume
            audioRef.volume = volume / 100
            set({ isMuted: false }, false, 'audioPlayer/unmute')
          } else {
            // Mute: set volume to 0 but keep volume state
            audioRef.volume = 0
            set({ isMuted: true }, false, 'audioPlayer/mute')
          }
        },

        loadTrack: (src, thumbnailUrl, title, trackId) => {
          const { audioRef, isPlaying, audioSrc, currentTime } = get()
          if (!audioRef) return

          if (!src) {
            alert("Yo, there's no preview audio for this one")
            return
          }

          if (src === audioSrc && !isPlaying) {
            get().play(title)
            return
          }

          if (src === audioSrc && isPlaying) {
            get().pause()
            return
          }

          if (audioSrc && currentTime > 0) {
            persistTimeToStorage(currentTime)
          }

          audioRef.src = src
          set(
            {
              audioSrc: src,
              thumbnailUrl,
              nowPlayingContext: {
                title,
                url:
                  typeof window !== 'undefined' ? window.location.pathname : '/'
              },
              currentTrackId: trackId || null,
              currentTime: 0,
              progress: 0
            },
            false,
            'audioPlayer/loadTrack'
          )

          get().play(title)
        },

        updateProgress: () => {
          const { audioRef } = get()
          if (!audioRef) return

          const progress = (audioRef.currentTime / audioRef.duration) * 100 || 0
          const now = Date.now()

          set(
            {
              progress,
              currentTime: audioRef.currentTime,
              duration: audioRef.duration || 0
            },
            false,
            'audioPlayer/updateProgress'
          )

          if (now - lastPersistTime >= PERSIST_INTERVAL) {
            lastPersistTime = now
            persistTimeToStorage(audioRef.currentTime)
          }
        },

        updatePlayingState: (playing) => {
          set({ isPlaying: playing }, false, 'audioPlayer/updatePlayingState')
        },

        updateNowPlaying: (context) => {
          set(
            (state) => ({
              nowPlayingContext: { ...state.nowPlayingContext, ...context }
            }),
            false,
            'audioPlayer/updateNowPlaying'
          )
        },

        initialize: () => {
          const { audioRef, audioSrc, volume, isMuted } = get()
          if (!audioRef) return

          audioRef.volume = isMuted ? 0 : volume / 100

          let persistedTime = 0
          try {
            const stored = localStorage.getItem('audio-player-store')
            if (stored) {
              const parsed = JSON.parse(stored)
              persistedTime = parsed.state?.currentTime || 0
            }
          } catch {
            // Ignore storage errors
          }

          if (audioSrc) {
            audioRef.src = audioSrc
            if (persistedTime > 0) {
              audioRef.addEventListener(
                'loadedmetadata',
                () => {
                  audioRef.currentTime = persistedTime
                  set(
                    { currentTime: persistedTime },
                    false,
                    'audioPlayer/restoreTime'
                  )
                },
                { once: true }
              )
            }
          }

          set({ isInitialized: true }, false, 'audioPlayer/initialize')
        },

        // Queue management actions
        addToQueue: (mix) => {
          const queueItem: QueueItem = {
            queueId: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            id: mix.id,
            title: mix.title,
            url: mix.url,
            thumbnailUrl: mix.thumbnailUrl || '',
            addedAt: Date.now()
          }

          set(
            (state) => ({ queue: [...state.queue, queueItem] }),
            false,
            'audioPlayer/addToQueue'
          )
        },

        removeFromQueue: (queueId) => {
          set(
            (state) => {
              const newQueue = state.queue.filter(
                (item) => item.queueId !== queueId
              )
              let newCurrentIndex = state.currentIndex

              // Adjust current index if needed
              const removedIndex = state.queue.findIndex(
                (item) => item.queueId === queueId
              )
              if (removedIndex !== -1 && removedIndex <= state.currentIndex) {
                newCurrentIndex = Math.max(-1, state.currentIndex - 1)
              }

              return {
                queue: newQueue,
                currentIndex:
                  newCurrentIndex >= newQueue.length ? -1 : newCurrentIndex
              }
            },
            false,
            'audioPlayer/removeFromQueue'
          )
        },

        clearQueue: () => {
          set({ queue: [], currentIndex: -1 }, false, 'audioPlayer/clearQueue')
        },

        reorderQueue: (fromIndex, toIndex) => {
          set(
            (state) => {
              const newQueue = [...state.queue]
              const [movedItem] = newQueue.splice(fromIndex, 1)
              newQueue.splice(toIndex, 0, movedItem)

              // Update current index if current track was moved
              let newCurrentIndex = state.currentIndex
              if (fromIndex === state.currentIndex) {
                newCurrentIndex = toIndex
              } else if (
                fromIndex < state.currentIndex &&
                toIndex >= state.currentIndex
              ) {
                newCurrentIndex = state.currentIndex - 1
              } else if (
                fromIndex > state.currentIndex &&
                toIndex <= state.currentIndex
              ) {
                newCurrentIndex = state.currentIndex + 1
              }

              return { queue: newQueue, currentIndex: newCurrentIndex }
            },
            false,
            'audioPlayer/reorderQueue'
          )
        },

        playFromQueue: (index) => {
          const { queue } = get()
          if (index < 0 || index >= queue.length) return

          const item = queue[index]
          set({ currentIndex: index }, false, 'audioPlayer/setCurrentIndex')
          get().loadTrack(
            item.url,
            item.thumbnailUrl || '',
            item.title,
            item.id
          )
        },

        playNext: () => {
          const { queue, currentIndex } = get()
          if (queue.length === 0) return

          const nextIndex = currentIndex + 1

          if (nextIndex >= queue.length) {
            return // End of queue
          }

          get().playFromQueue(nextIndex)
        },

        playPrevious: () => {
          const { queue, currentIndex } = get()
          if (queue.length === 0) return

          const prevIndex =
            currentIndex - 1 < 0 ? queue.length - 1 : currentIndex - 1

          get().playFromQueue(prevIndex)
        },

        toggleQueue: () => {
          set(
            (state) => ({ isQueueVisible: !state.isQueueVisible }),
            false,
            'audioPlayer/toggleQueue'
          )
        },

        toggleFullscreen: () => {
          set(
            (state) => ({ isFullscreenVisible: !state.isFullscreenVisible }),
            false,
            'audioPlayer/toggleFullscreen'
          )
        },

        closeFullscreen: () => {
          set(
            { isFullscreenVisible: false },
            false,
            'audioPlayer/closeFullscreen'
          )
        }
      }),
      {
        name: 'audio-player-store',
        partialize: (state) => ({
          isPlaying: false,
          volume: state.volume,
          isMuted: state.isMuted,
          audioSrc: state.audioSrc,
          thumbnailUrl: state.thumbnailUrl,
          nowPlayingContext: state.nowPlayingContext,
          currentTrackId: state.currentTrackId,
          queue: state.queue,
          currentIndex: state.currentIndex,
          isQueueVisible: state.isQueueVisible
        })
      }
    ),
    {
      name: 'audioPlayer'
    }
  )
)

// Convenience hook for common audio player actions
export const useAudioPlayerActions = () => {
  const store = useAudioPlayerStore()
  return {
    play: store.play,
    pause: store.pause,
    togglePlayPause: store.togglePlayPause,
    jumpForward: store.jumpForward,
    jumpBackward: store.jumpBackward,
    loadTrack: store.loadTrack,
    setTimeUsingPercentage: store.setTimeUsingPercentage,
    setVolume: store.setVolume,
    toggleMute: store.toggleMute,
    // Queue actions
    addToQueue: store.addToQueue,
    removeFromQueue: store.removeFromQueue,
    clearQueue: store.clearQueue,
    reorderQueue: store.reorderQueue,
    playFromQueue: store.playFromQueue,
    playNext: store.playNext,
    playPrevious: store.playPrevious,
    toggleQueue: store.toggleQueue,
    toggleFullscreen: store.toggleFullscreen,
    closeFullscreen: store.closeFullscreen
  }
}

// Hook for accessing audio player state
export const useAudioPlayerState = () => {
  const store = useAudioPlayerStore()
  return {
    isPlaying: store.isPlaying,
    progress: store.progress,
    currentTime: store.currentTime,
    duration: store.duration,
    volume: store.volume,
    isMuted: store.isMuted,
    audioSrc: store.audioSrc,
    thumbnailUrl: store.thumbnailUrl,
    nowPlayingContext: store.nowPlayingContext,
    currentTrackId: store.currentTrackId,
    audioRef: store.audioRef,
    // Queue state
    queue: store.queue,
    currentIndex: store.currentIndex,
    isQueueVisible: store.isQueueVisible,
    isFullscreenVisible: store.isFullscreenVisible
  }
}
