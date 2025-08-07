import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { SelectMix } from '@gbfm/vps/src/db/mix.schema'

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

  // Queue state (persisted)
  queue: QueueItem[]
  currentIndex: number
  isQueueVisible: boolean
  repeatMode: 'none' | 'one' | 'all'
  isShuffled: boolean
  shuffledQueue: QueueItem[] // Shuffled version of queue
  shuffledIndex: number // Current index in shuffled queue

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
  loadTrack: (src: string, thumbnailUrl: string, title: string) => void

  // Queue management
  addToQueue: (mix: SelectMix) => void
  removeFromQueue: (itemId: string) => void
  clearQueue: () => void
  reorderQueue: (fromIndex: number, toIndex: number) => void
  playFromQueue: (index: number) => void
  playNext: () => void
  playPrevious: () => void
  toggleQueue: () => void
  toggleRepeat: () => void
  toggleShuffle: () => void
  toggleFullscreen: () => void

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

        // Queue state
        queue: [],
        currentIndex: -1,
        isQueueVisible: false,
        repeatMode: 'none',
        isShuffled: false,
        shuffledQueue: [],
        shuffledIndex: -1,

        isInitialized: false,
        isFullscreenVisible: false,

        // Actions
        setAudioRef: (ref) => {
          set({ audioRef: ref }, false, 'audioPlayer/setAudioRef')

          if (ref) {
            // Set up event listeners
            ref.onended = () => {
              const { queue, currentIndex, repeatMode } = get()

              if (repeatMode === 'one') {
                // Replay current track
                ref.currentTime = 0
                get().play()
              } else if (queue.length > 0 && currentIndex < queue.length - 1) {
                // Play next track in queue
                get().playNext()
              } else if (queue.length > 0 && repeatMode === 'all') {
                // Loop back to first track
                get().playFromQueue(0)
              } else {
                // End of queue, just pause
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

            // Initialize with persisted state
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
          const { audioRef } = get()
          if (!audioRef) return

          audioRef.pause()
          set({ isPlaying: false }, false, 'audioPlayer/pause')
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

        loadTrack: (src, thumbnailUrl, title) => {
          const { audioRef, isPlaying, audioSrc } = get()
          if (!audioRef) return

          if (!src) {
            alert("Yo, there's no preview audio for this one")
            return
          }

          // If same track and currently paused, just play
          if (src === audioSrc && !isPlaying) {
            get().play(title)
            return
          }

          // If same track and playing, pause
          if (src === audioSrc && isPlaying) {
            get().pause()
            return
          }

          // Load new track
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
          set(
            {
              progress,
              currentTime: audioRef.currentTime,
              duration: audioRef.duration || 0
            },
            false,
            'audioPlayer/updateProgress'
          )
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
          const { audioRef, audioSrc, currentTime, volume, isMuted } = get()
          if (!audioRef) return

          // Restore persisted volume
          audioRef.volume = isMuted ? 0 : volume / 100

          // Restore persisted audio source and position
          if (audioSrc) {
            audioRef.src = audioSrc
            if (currentTime > 0) {
              // Set currentTime after loadedmetadata event to ensure it works
              audioRef.addEventListener(
                'loadedmetadata',
                () => {
                  audioRef.currentTime = currentTime
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
            thumbnailUrl: mix.thumbnailUrl,
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
          get().loadTrack(item.url, item.thumbnailUrl || '', item.title)
        },

        playNext: () => {
          const {
            queue,
            currentIndex,
            repeatMode,
            isShuffled,
            shuffledQueue,
            shuffledIndex
          } = get()
          if (queue.length === 0) return

          if (isShuffled) {
            let nextShuffledIndex = shuffledIndex + 1

            if (nextShuffledIndex >= shuffledQueue.length) {
              if (repeatMode === 'all') {
                nextShuffledIndex = 0
              } else {
                return // End of shuffled queue
              }
            }

            const nextTrack = shuffledQueue[nextShuffledIndex]
            const originalIndex = queue.findIndex(
              (item) => item.queueId === nextTrack.queueId
            )

            set(
              {
                currentIndex: originalIndex,
                shuffledIndex: nextShuffledIndex
              },
              false,
              'audioPlayer/playNext'
            )

            get().loadTrack(
              nextTrack.url,
              nextTrack.thumbnailUrl || '',
              nextTrack.title
            )
          } else {
            let nextIndex = currentIndex + 1

            if (nextIndex >= queue.length) {
              if (repeatMode === 'all') {
                nextIndex = 0
              } else {
                return // End of queue
              }
            }

            get().playFromQueue(nextIndex)
          }
        },

        playPrevious: () => {
          const {
            queue,
            currentIndex,
            isShuffled,
            shuffledQueue,
            shuffledIndex
          } = get()
          if (queue.length === 0) return

          if (isShuffled) {
            let prevShuffledIndex = shuffledIndex - 1

            if (prevShuffledIndex < 0) {
              prevShuffledIndex = shuffledQueue.length - 1
            }

            const prevTrack = shuffledQueue[prevShuffledIndex]
            const originalIndex = queue.findIndex(
              (item) => item.queueId === prevTrack.queueId
            )

            set(
              {
                currentIndex: originalIndex,
                shuffledIndex: prevShuffledIndex
              },
              false,
              'audioPlayer/playPrevious'
            )

            get().loadTrack(
              prevTrack.url,
              prevTrack.thumbnailUrl || '',
              prevTrack.title
            )
          } else {
            let prevIndex = currentIndex - 1

            if (prevIndex < 0) {
              prevIndex = queue.length - 1
            }

            get().playFromQueue(prevIndex)
          }
        },

        toggleQueue: () => {
          set(
            (state) => ({ isQueueVisible: !state.isQueueVisible }),
            false,
            'audioPlayer/toggleQueue'
          )
        },

        toggleRepeat: () => {
          set(
            (state) => {
              const modes: Array<'none' | 'one' | 'all'> = [
                'none',
                'one',
                'all'
              ]
              const currentIndex = modes.indexOf(state.repeatMode)
              const nextMode = modes[(currentIndex + 1) % modes.length]
              return { repeatMode: nextMode }
            },
            false,
            'audioPlayer/toggleRepeat'
          )
        },

        toggleShuffle: () => {
          set(
            (state) => {
              const newIsShuffled = !state.isShuffled

              if (newIsShuffled) {
                // Create shuffled version of queue
                const shuffled = [...state.queue].sort(
                  () => Math.random() - 0.5
                )
                const currentTrack =
                  state.currentIndex >= 0
                    ? state.queue[state.currentIndex]
                    : null

                // Find current track in shuffled queue
                let newShuffledIndex = -1
                if (currentTrack) {
                  newShuffledIndex = shuffled.findIndex(
                    (item) => item.queueId === currentTrack.queueId
                  )
                }

                return {
                  isShuffled: true,
                  shuffledQueue: shuffled,
                  shuffledIndex: newShuffledIndex
                }
              } else {
                // Turn off shuffle, find current track in original queue
                const currentTrack =
                  state.shuffledIndex >= 0
                    ? state.shuffledQueue[state.shuffledIndex]
                    : null
                let newCurrentIndex = -1
                if (currentTrack) {
                  newCurrentIndex = state.queue.findIndex(
                    (item) => item.queueId === currentTrack.queueId
                  )
                }

                return {
                  isShuffled: false,
                  shuffledQueue: [],
                  shuffledIndex: -1,
                  currentIndex: newCurrentIndex
                }
              }
            },
            false,
            'audioPlayer/toggleShuffle'
          )
        },

        toggleFullscreen: () => {
          set(
            (state) => ({ isFullscreenVisible: !state.isFullscreenVisible }),
            false,
            'audioPlayer/toggleFullscreen'
          )
        }
      }),
      {
        name: 'audio-player-store',
        partialize: (state) => ({
          // Only persist these values
          isPlaying: false, // Always start paused on reload
          currentTime: state.currentTime,
          volume: state.volume,
          isMuted: state.isMuted,
          audioSrc: state.audioSrc,
          thumbnailUrl: state.thumbnailUrl,
          nowPlayingContext: state.nowPlayingContext,
          // Queue state
          queue: state.queue,
          currentIndex: state.currentIndex,
          isQueueVisible: state.isQueueVisible,
          repeatMode: state.repeatMode,
          isShuffled: state.isShuffled,
          shuffledQueue: state.shuffledQueue,
          shuffledIndex: state.shuffledIndex
          // Don't persist audioRef, progress, duration, isInitialized
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
    toggleRepeat: store.toggleRepeat,
    toggleShuffle: store.toggleShuffle,
    toggleFullscreen: store.toggleFullscreen
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
    audioRef: store.audioRef,
    // Queue state
    queue: store.queue,
    currentIndex: store.currentIndex,
    isQueueVisible: store.isQueueVisible,
    repeatMode: store.repeatMode,
    isShuffled: store.isShuffled,
    isFullscreenVisible: store.isFullscreenVisible
  }
}
