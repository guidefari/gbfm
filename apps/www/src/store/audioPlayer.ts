import { isFeatureEnabled } from '@gbfm/core/feature-flags'
import { toast } from '@gbfm/ui'
import type { SelectAudio, SelectMdxCompiledAudio } from '@gbfm/vps/schemas'
import * as Effect from 'effect/Effect'
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { RuntimeClient } from '@/runtime'
import { track } from '@/services/analytics'
import {
  type Creator,
  clearPosition,
  initialPlayerState,
  type NowPlayingContext,
  type PlayerState,
  playerReducer,
  type QueueItem,
  readPosition,
  setActionHandlers,
  setMetadata,
  setPlaybackState,
  setPositionState,
  writePosition
} from '@/services/audio-player'

let lastPersistTime = 0
const PERSIST_INTERVAL = 5000

const pageUrl = () =>
  typeof window !== 'undefined' ? window.location.pathname : '/'

interface AudioPlayerActions {
  audioRef: HTMLAudioElement | null
  setAudioRef: (ref: HTMLAudioElement | null) => void

  play: (title?: string) => void
  pause: () => void
  togglePlayPause: () => void
  jumpForward: (seconds?: number) => void
  jumpBackward: (seconds?: number) => void
  setTimeUsingPercentage: (percentage: number) => void

  setVolume: (volume: number) => void
  toggleMute: () => void

  loadTrack: (
    src: string,
    thumbnailUrl: string,
    title: string,
    trackId?: string,
    creators?: Creator[],
    slug?: string
  ) => void
  preloadTrack: (
    src: string,
    thumbnailUrl: string,
    title: string,
    trackId?: string,
    creators?: Creator[],
    slug?: string
  ) => void

  addToQueue: (mix: SelectAudio | SelectMdxCompiledAudio) => void
  removeFromQueue: (itemId: string) => void
  clearQueue: () => void
  reorderQueue: (fromIndex: number, toIndex: number) => void
  playFromQueue: (index: number) => void
  playNext: () => void
  playPrevious: () => void
  toggleQueue: () => void
  toggleFullscreen: () => void
  closeFullscreen: () => void

  updateProgress: () => void
  updatePlayingState: (playing: boolean) => void
  updateNowPlaying: (context: Partial<NowPlayingContext>) => void

  initialize: () => void
}

type AudioPlayerStore = PlayerState & AudioPlayerActions

export const useAudioPlayerStore = create<AudioPlayerStore>()(
  devtools(
    persist(
      (set, get) => {
        const send = (
          action: Parameters<typeof playerReducer>[1],
          label: string
        ) => set((state) => playerReducer(state, action), false, label)

        return {
          ...initialPlayerState,
          audioRef: null,

          setAudioRef: (ref) => {
            set(() => ({ audioRef: ref }), false, 'audioPlayer/setAudioRef')

            if (!ref) return

            ref.onended = () => {
              const {
                queue,
                currentIndex,
                currentTrackId,
                nowPlayingContext,
                duration
              } = get()

              void RuntimeClient.runPromise(
                Effect.gen(function* () {
                  yield* setPlaybackState('none')

                  if (currentTrackId) {
                    yield* clearPosition(currentTrackId)
                  }

                  yield* track('audio_completed', {
                    trackId: currentTrackId,
                    title: nowPlayingContext.title,
                    duration
                  })
                })
              )

              if (queue.length > 0 && currentIndex < queue.length - 1) {
                get().playNext()
              } else {
                send({ type: 'TRACK_ENDED' }, 'audioPlayer/trackEnded')
              }
            }

            ref.ontimeupdate = () => get().updateProgress()

            ref.onloadedmetadata = () => {
              send(
                {
                  type: 'UPDATE_PROGRESS',
                  currentTime: ref.currentTime,
                  duration: ref.duration || 0
                },
                'audioPlayer/updateDuration'
              )
              void RuntimeClient.runPromise(
                setPositionState(ref.duration || 0, ref.currentTime)
              )
            }

            ref.onerror = () => {
              const { currentTrackId, nowPlayingContext } = get()
              void RuntimeClient.runPromise(
                track('audio_error', {
                  trackId: currentTrackId,
                  title: nowPlayingContext.title,
                  errorMessage: ref.error?.message ?? 'unknown'
                })
              )
            }

            document.addEventListener('visibilitychange', () => {
              if (document.hidden) {
                const { currentTime, currentTrackId } = get()
                if (currentTime > 0 && currentTrackId) {
                  void RuntimeClient.runPromise(
                    writePosition(currentTrackId, currentTime)
                  )
                  lastPersistTime = Date.now()
                }
              }
            })

            void RuntimeClient.runPromise(
              setActionHandlers({
                onPlay: () => get().play(),
                onPause: () => get().pause(),
                onSeekBackward: (offset) => get().jumpBackward(offset),
                onSeekForward: (offset) => get().jumpForward(offset),
                onPreviousTrack: () => get().playPrevious(),
                onNextTrack: () => get().playNext(),
                onSeekTo: (time) => {
                  const { audioRef: ar } = get()
                  if (ar) ar.currentTime = time
                }
              })
            )

            if (!get().isInitialized) {
              get().initialize()
            }
          },

          play: (title) => {
            const { audioRef } = get()
            if (!audioRef) return

            void audioRef.play().catch((err: unknown) => {
              void RuntimeClient.runPromise(
                track('audio_error', {
                  trackId: get().currentTrackId,
                  title: get().nowPlayingContext.title,
                  errorMessage:
                    err instanceof Error ? err.message : 'play() rejected'
                })
              )
            })

            send(
              { type: 'PLAY', title, pageUrl: pageUrl() },
              'audioPlayer/play'
            )
            void RuntimeClient.runPromise(setPlaybackState('playing'))
          },

          pause: () => {
            const {
              audioRef,
              currentTime,
              currentTrackId,
              nowPlayingContext,
              progress
            } = get()
            if (!audioRef) return

            audioRef.pause()
            send({ type: 'PAUSE' }, 'audioPlayer/pause')

            void RuntimeClient.runPromise(
              Effect.gen(function* () {
                yield* setPlaybackState('paused')

                if (currentTime > 0 && currentTrackId) {
                  yield* writePosition(currentTrackId, currentTime)
                }

                yield* track('audio_paused', {
                  trackId: currentTrackId,
                  title: nowPlayingContext.title,
                  progressPercent: progress,
                  currentTime
                })
              })
            )
            lastPersistTime = Date.now()
          },

          togglePlayPause: () => {
            const { isPlaying } = get()
            if (isPlaying) get().pause()
            else get().play()
          },

          jumpForward: (seconds = 30) => {
            const { audioRef } = get()
            if (!audioRef?.src) return
            const from = audioRef.currentTime
            audioRef.currentTime += seconds
            void RuntimeClient.runPromise(
              track('audio_seek', {
                trackId: get().currentTrackId,
                fromTime: from,
                toTime: audioRef.currentTime,
                method: 'keyboard'
              })
            )
          },

          jumpBackward: (seconds = 15) => {
            const { audioRef } = get()
            if (!audioRef?.src) return
            const from = audioRef.currentTime
            audioRef.currentTime -= seconds
            void RuntimeClient.runPromise(
              track('audio_seek', {
                trackId: get().currentTrackId,
                fromTime: from,
                toTime: audioRef.currentTime,
                method: 'keyboard'
              })
            )
          },

          setTimeUsingPercentage: (percentage) => {
            const { audioRef } = get()
            if (!audioRef) return
            const from = audioRef.currentTime
            const newTime = (percentage / 100) * audioRef.duration
            audioRef.currentTime = newTime
            send(
              { type: 'SET_TIME', percentage, duration: audioRef.duration },
              'audioPlayer/setTime'
            )
            void RuntimeClient.runPromise(
              track('audio_seek', {
                trackId: get().currentTrackId,
                fromTime: from,
                toTime: newTime,
                method: 'scrub'
              })
            )
          },

          setVolume: (volume) => {
            const { audioRef } = get()
            if (!audioRef) return
            const clamped = Math.max(0, Math.min(100, volume))
            audioRef.volume = clamped / 100
            send(
              { type: 'SET_VOLUME', volume: clamped },
              'audioPlayer/setVolume'
            )
          },

          toggleMute: () => {
            const { audioRef, isMuted, volume } = get()
            if (!audioRef) return
            audioRef.volume = isMuted ? volume / 100 : 0
            send({ type: 'TOGGLE_MUTE' }, 'audioPlayer/toggleMute')
          },

          loadTrack: (src, thumbnailUrl, title, trackId, creators, slug) => {
            const {
              audioRef,
              isPlaying,
              audioSrc,
              currentTime,
              currentTrackId
            } = get()
            if (!audioRef) return

            if (!src) {
              toast({
                title: 'No preview available',
                description: "There's no preview audio for this track",
                variant: 'destructive'
              })
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

            if (currentTrackId && currentTime > 0) {
              void RuntimeClient.runPromise(
                writePosition(currentTrackId, currentTime)
              )
            }

            audioRef.src = src
            send(
              {
                type: 'LOAD_TRACK',
                src,
                thumbnailUrl,
                title,
                trackId,
                creators,
                slug,
                pageUrl: pageUrl()
              },
              'audioPlayer/loadTrack'
            )

            void RuntimeClient.runPromise(
              Effect.gen(function* () {
                yield* setMetadata(
                  title,
                  creators?.map((c) => c.name) ?? [],
                  thumbnailUrl
                )

                yield* track('audio_played', {
                  trackId: trackId ?? null,
                  title,
                  slug: slug ?? null,
                  pageUrl: pageUrl()
                })
              })
            )

            get().play(title)
          },

          preloadTrack: (src, thumbnailUrl, title, trackId, creators, slug) => {
            const { audioRef } = get()
            if (!audioRef || !src) return

            audioRef.src = src
            send(
              {
                type: 'PRELOAD_TRACK',
                src,
                thumbnailUrl,
                title,
                trackId,
                creators,
                slug,
                pageUrl: pageUrl()
              },
              'audioPlayer/preloadTrack'
            )
          },

          updateProgress: () => {
            const { audioRef } = get()
            if (!audioRef) return

            const now = Date.now()
            send(
              {
                type: 'UPDATE_PROGRESS',
                currentTime: audioRef.currentTime,
                duration: audioRef.duration || 0
              },
              'audioPlayer/updateProgress'
            )

            if (now - lastPersistTime >= PERSIST_INTERVAL) {
              lastPersistTime = now
              const { currentTrackId } = get()
              if (currentTrackId) {
                void RuntimeClient.runPromise(
                  Effect.gen(function* () {
                    yield* writePosition(currentTrackId, audioRef.currentTime)
                    yield* setPositionState(
                      audioRef.duration || 0,
                      audioRef.currentTime
                    )
                  })
                )
              }
            }
          },

          updatePlayingState: (playing) => {
            send(
              { type: 'UPDATE_PLAYING_STATE', playing },
              'audioPlayer/updatePlayingState'
            )
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
            const { audioRef, audioSrc, volume, isMuted, currentTrackId } =
              get()
            if (!audioRef) return

            audioRef.volume = isMuted ? 0 : volume / 100

            if (audioSrc) {
              audioRef.src = audioSrc

              if (currentTrackId) {
                void RuntimeClient.runPromise(
                  Effect.gen(function* () {
                    const savedTime = yield* readPosition(currentTrackId)
                    if (savedTime && savedTime > 0) {
                      audioRef.addEventListener(
                        'loadedmetadata',
                        () => {
                          audioRef.currentTime = savedTime
                        },
                        { once: true }
                      )
                    }
                  })
                )
              }
            }

            send({ type: 'SET_INITIALIZED' }, 'audioPlayer/initialize')
          },

          addToQueue: (mix) => {
            if (!isFeatureEnabled('ui.queue')) return
            send({ type: 'ADD_TO_QUEUE', mix }, 'audioPlayer/addToQueue')
            void RuntimeClient.runPromise(
              track('audio_queue_action', {
                action: 'add',
                trackId: mix.id,
                queueLength: get().queue.length
              })
            )
          },

          removeFromQueue: (queueId) => {
            send(
              { type: 'REMOVE_FROM_QUEUE', queueId },
              'audioPlayer/removeFromQueue'
            )
            void RuntimeClient.runPromise(
              track('audio_queue_action', {
                action: 'remove',
                queueLength: get().queue.length
              })
            )
          },

          clearQueue: () => {
            send({ type: 'CLEAR_QUEUE' }, 'audioPlayer/clearQueue')
            void RuntimeClient.runPromise(
              track('audio_queue_action', {
                action: 'clear',
                queueLength: 0
              })
            )
          },

          reorderQueue: (fromIndex, toIndex) => {
            send(
              { type: 'REORDER_QUEUE', fromIndex, toIndex },
              'audioPlayer/reorderQueue'
            )
            void RuntimeClient.runPromise(
              track('audio_queue_action', {
                action: 'reorder',
                queueLength: get().queue.length
              })
            )
          },

          playFromQueue: (index) => {
            const { queue } = get()
            if (index < 0 || index >= queue.length) return
            const item = queue[index]
            send(
              { type: 'SET_CURRENT_INDEX', index },
              'audioPlayer/setCurrentIndex'
            )
            void RuntimeClient.runPromise(
              track('audio_queue_action', {
                action: 'play_from',
                trackId: item.id,
                queueLength: queue.length
              })
            )
            get().loadTrack(
              item.url,
              item.thumbnailUrl || '',
              item.title,
              item.id,
              item.creators,
              item.slug
            )
          },

          playNext: () => {
            const { queue, currentIndex } = get()
            if (queue.length === 0) return
            const nextIndex = currentIndex + 1
            if (nextIndex >= queue.length) return
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
            if (!isFeatureEnabled('ui.queue')) return
            send({ type: 'TOGGLE_QUEUE' }, 'audioPlayer/toggleQueue')
          },

          toggleFullscreen: () => {
            send({ type: 'TOGGLE_FULLSCREEN' }, 'audioPlayer/toggleFullscreen')
          },

          closeFullscreen: () => {
            send({ type: 'CLOSE_FULLSCREEN' }, 'audioPlayer/closeFullscreen')
          }
        }
      },
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
          currentTime: state.currentTime,
          queue: state.queue,
          currentIndex: state.currentIndex,
          isQueueVisible: state.isQueueVisible
        })
      }
    ),
    { name: 'audioPlayer' }
  )
)

export const useAudioPlayerActions = () => {
  const store = useAudioPlayerStore()
  return {
    play: store.play,
    pause: store.pause,
    togglePlayPause: store.togglePlayPause,
    jumpForward: store.jumpForward,
    jumpBackward: store.jumpBackward,
    loadTrack: store.loadTrack,
    preloadTrack: store.preloadTrack,
    setTimeUsingPercentage: store.setTimeUsingPercentage,
    setVolume: store.setVolume,
    toggleMute: store.toggleMute,
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
    queue: store.queue,
    currentIndex: store.currentIndex,
    isQueueVisible: store.isQueueVisible,
    isFullscreenVisible: store.isFullscreenVisible,
    isInitialized: store.isInitialized
  }
}

export type { Creator, NowPlayingContext, QueueItem }
