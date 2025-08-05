import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface NowPlayingContext {
  url: string
  title: string
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

  // State management
  isInitialized: boolean
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
        isInitialized: false,

        // Actions
        setAudioRef: (ref) => {
          set({ audioRef: ref }, false, 'audioPlayer/setAudioRef')

          if (ref) {
            // Set up event listeners
            ref.onended = () => {
              get().pause()
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
          nowPlayingContext: state.nowPlayingContext
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
    toggleMute: store.toggleMute
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
    audioRef: store.audioRef
  }
}
