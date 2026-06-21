import { isFeatureEnabled } from '@gbfm/core/feature-flags'
import { toast } from '@gbfm/ui'
import type { SelectAudio, SelectMdxCompiledAudio } from '@gbfm/vps/schemas'
import * as Effect from 'effect/Effect'
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
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
  createQueueItem,
  readPosition,
  resolveLoadTrack,
  resolvePauseEffects,
  resolvePercentageSeek,
  resolveProgressUpdate,
  resolveRelativeSeek,
  setActionHandlers,
  setMetadata,
  setPlaybackState,
  setPositionState,
  writePosition
} from '@/services/audio-player'

let lastPersistTime = 0
const PERSIST_INTERVAL = 5000
let progressFrameId: number | null = null

const pageUrl = () => (typeof window !== 'undefined' ? window.location.pathname : '/')

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
  startProgressTracking: () => void
  stopProgressTracking: () => void
  updatePlayingState: (playing: boolean) => void
  updateNowPlaying: (context: Partial<NowPlayingContext>) => void

  initialize: () => void
}

type AudioPlayerStore = PlayerState & AudioPlayerActions

export const useAudioPlayerStore = create<AudioPlayerStore>()(
  devtools(
    persist(
      (set, get) => {
        const send = (action: Parameters<typeof playerReducer>[1], label: string) =>
          set((state) => playerReducer(state, action), false, label)

        const stopProgressTracking = () => {
          if (progressFrameId === null) return

          window.cancelAnimationFrame(progressFrameId)
          progressFrameId = null
        }

        const scheduleProgressTracking = () => {
          if (typeof window === 'undefined' || progressFrameId !== null) return

          const tick = () => {
            progressFrameId = null
            const { audioRef, isPlaying } = get()

            if (!audioRef || !isPlaying) {
              return
            }

            get().updateProgress()
            progressFrameId = window.requestAnimationFrame(tick)
          }

          progressFrameId = window.requestAnimationFrame(tick)
        }

        return {
          ...initialPlayerState,
          audioRef: null,

          setAudioRef: (ref) => {
            set(() => ({ audioRef: ref }), false, 'audioPlayer/setAudioRef')

            if (!ref) {
              stopProgressTracking()
              return
            }

            ref.onended = () => {
              stopProgressTracking()
              const { queue, currentIndex, currentTrackId, nowPlayingContext, duration } = get()

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

            ref.onloadedmetadata = () => {
              send(
                {
                  type: 'UPDATE_PROGRESS',
                  currentTime: ref.currentTime,
                  duration: ref.duration || 0
                },
                'audioPlayer/updateDuration'
              )
              void RuntimeClient.runPromise(setPositionState(ref.duration || 0, ref.currentTime))
            }

            ref.onplay = () => {
              scheduleProgressTracking()
            }

            ref.onpause = () => {
              stopProgressTracking()
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
                  void RuntimeClient.runPromise(writePosition(currentTrackId, currentTime))
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
                  errorMessage: err instanceof Error ? err.message : 'play() rejected'
                })
              )
            })

            send({ type: 'PLAY', title, pageUrl: pageUrl() }, 'audioPlayer/play')
            void RuntimeClient.runPromise(setPlaybackState('playing'))
          },

          pause: () => {
            const { audioRef, currentTime, currentTrackId, nowPlayingContext, progress } = get()
            if (!audioRef) return

            audioRef.pause()
            send({ type: 'PAUSE' }, 'audioPlayer/pause')
            const pauseEffects = resolvePauseEffects({
              currentTime,
              currentTrackId,
              nowPlayingContext,
              progress
            })

            void RuntimeClient.runPromise(
              Effect.gen(function* () {
                yield* setPlaybackState(pauseEffects.playbackState)

                if (pauseEffects.persistPosition) {
                  yield* writePosition(
                    pauseEffects.persistPosition.trackId,
                    pauseEffects.persistPosition.time
                  )
                }

                yield* track('audio_paused', pauseEffects.pausedEvent)
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
            const decision = resolveRelativeSeek({
              fromTime: audioRef.currentTime,
              deltaSeconds: seconds,
              trackId: get().currentTrackId,
              method: 'keyboard'
            })
            audioRef.currentTime = decision.toTime
            void RuntimeClient.runPromise(track('audio_seek', decision.seekEvent))
          },

          jumpBackward: (seconds = 15) => {
            const { audioRef } = get()
            if (!audioRef?.src) return
            const decision = resolveRelativeSeek({
              fromTime: audioRef.currentTime,
              deltaSeconds: -seconds,
              trackId: get().currentTrackId,
              method: 'keyboard'
            })
            audioRef.currentTime = decision.toTime
            void RuntimeClient.runPromise(track('audio_seek', decision.seekEvent))
          },

          setTimeUsingPercentage: (percentage) => {
            const { audioRef } = get()
            if (!audioRef) return
            const decision = resolvePercentageSeek({
              percentage,
              duration: audioRef.duration,
              fromTime: audioRef.currentTime,
              trackId: get().currentTrackId
            })
            audioRef.currentTime = decision.toTime
            send(decision.action, 'audioPlayer/setTime')
            get().updateProgress()
            void RuntimeClient.runPromise(track('audio_seek', decision.seekEvent))
          },

          setVolume: (volume) => {
            const { audioRef } = get()
            if (!audioRef) return
            const clamped = Math.max(0, Math.min(100, volume))
            audioRef.volume = clamped / 100
            send({ type: 'SET_VOLUME', volume: clamped }, 'audioPlayer/setVolume')
          },

          toggleMute: () => {
            const { audioRef, isMuted, volume } = get()
            if (!audioRef) return
            audioRef.volume = isMuted ? volume / 100 : 0
            send({ type: 'TOGGLE_MUTE' }, 'audioPlayer/toggleMute')
          },

          loadTrack: (src, thumbnailUrl, title, trackId, creators, slug) => {
            const { audioRef, isPlaying, audioSrc, currentTime, currentTrackId } = get()
            if (!audioRef) return
            const currentPageUrl = pageUrl()
            const decision = resolveLoadTrack(
              {
                audioSrc,
                isPlaying,
                currentTime,
                currentTrackId
              },
              {
                src,
                thumbnailUrl,
                title,
                trackId,
                creators,
                slug
              },
              currentPageUrl
            )

            if (decision.type === 'no-preview') {
              toast({
                title: 'No preview available',
                description: "There's no preview audio for this track",
                variant: 'destructive'
              })
              return
            }

            if (decision.type === 'resume-current') {
              get().play(decision.title)
              return
            }

            if (decision.type === 'pause-current') {
              get().pause()
              return
            }

            if (decision.persistPreviousPosition) {
              void RuntimeClient.runPromise(
                writePosition(
                  decision.persistPreviousPosition.trackId,
                  decision.persistPreviousPosition.time
                )
              )
            }

            audioRef.src = decision.src
            send(decision.action, 'audioPlayer/loadTrack')

            void RuntimeClient.runPromise(
              Effect.gen(function* () {
                yield* setMetadata(
                  decision.metadata.title,
                  decision.metadata.artists,
                  decision.metadata.artwork
                )

                yield* track('audio_played', decision.playedEvent)
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

            const decision = resolveProgressUpdate({
              currentTime: audioRef.currentTime,
              duration: audioRef.duration || 0,
              currentTrackId: get().currentTrackId,
              now: Date.now(),
              lastPersistTime,
              persistInterval: PERSIST_INTERVAL
            })
            send(decision.action, 'audioPlayer/updateProgress')

            lastPersistTime = decision.nextLastPersistTime

            const persistPosition = decision.persistPosition
            const positionState = decision.positionState

            if (persistPosition && positionState) {
              void RuntimeClient.runPromise(
                Effect.gen(function* () {
                  yield* writePosition(persistPosition.trackId, persistPosition.time)
                  yield* setPositionState(positionState.duration, positionState.position)
                })
              )
            }
          },

          startProgressTracking: () => {
            scheduleProgressTracking()
          },

          stopProgressTracking: () => {
            stopProgressTracking()
          },

          updatePlayingState: (playing) => {
            send({ type: 'UPDATE_PLAYING_STATE', playing }, 'audioPlayer/updatePlayingState')
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
            const { audioRef, audioSrc, volume, isMuted, currentTrackId } = get()
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
                          send(
                            {
                              type: 'UPDATE_PROGRESS',
                              currentTime: savedTime,
                              duration: audioRef.duration || 0
                            },
                            'audioPlayer/restoreProgress'
                          )
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
            const item = createQueueItem({
              mix,
              queueIdTime: Date.now(),
              addedAt: Date.now(),
              idSuffix: Math.random().toString(36).substr(2, 9)
            })
            send({ type: 'ADD_TO_QUEUE', item }, 'audioPlayer/addToQueue')
            void RuntimeClient.runPromise(
              track('audio_queue_action', {
                action: 'add',
                trackId: mix.id,
                queueLength: get().queue.length
              })
            )
          },

          removeFromQueue: (queueId) => {
            send({ type: 'REMOVE_FROM_QUEUE', queueId }, 'audioPlayer/removeFromQueue')
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
            send({ type: 'REORDER_QUEUE', fromIndex, toIndex }, 'audioPlayer/reorderQueue')
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
            send({ type: 'SET_CURRENT_INDEX', index }, 'audioPlayer/setCurrentIndex')
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
            const prevIndex = currentIndex - 1 < 0 ? queue.length - 1 : currentIndex - 1
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
  const store = useAudioPlayerStore(
    useShallow((state) => ({
      play: state.play,
      pause: state.pause,
      togglePlayPause: state.togglePlayPause,
      jumpForward: state.jumpForward,
      jumpBackward: state.jumpBackward,
      loadTrack: state.loadTrack,
      preloadTrack: state.preloadTrack,
      setTimeUsingPercentage: state.setTimeUsingPercentage,
      setVolume: state.setVolume,
      toggleMute: state.toggleMute,
      addToQueue: state.addToQueue,
      removeFromQueue: state.removeFromQueue,
      clearQueue: state.clearQueue,
      reorderQueue: state.reorderQueue,
      playFromQueue: state.playFromQueue,
      playNext: state.playNext,
      playPrevious: state.playPrevious,
      toggleQueue: state.toggleQueue,
      toggleFullscreen: state.toggleFullscreen,
      closeFullscreen: state.closeFullscreen,
      startProgressTracking: state.startProgressTracking,
      stopProgressTracking: state.stopProgressTracking
    }))
  )
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
    closeFullscreen: store.closeFullscreen,
    startProgressTracking: store.startProgressTracking,
    stopProgressTracking: store.stopProgressTracking
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

export const useAudioPlayerPlaybackState = () =>
  useAudioPlayerStore(
    useShallow((state) => ({
      audioSrc: state.audioSrc,
      isPlaying: state.isPlaying,
      thumbnailUrl: state.thumbnailUrl,
      nowPlayingContext: state.nowPlayingContext,
      currentTrackId: state.currentTrackId
    }))
  )

export const useAudioPlayerVisibilityState = () =>
  useAudioPlayerStore(
    useShallow((state) => ({
      isFullscreenVisible: state.isFullscreenVisible,
      isQueueVisible: state.isQueueVisible
    }))
  )

export const useAudioPlayerQueueState = () =>
  useAudioPlayerStore(
    useShallow((state) => ({
      queue: state.queue,
      currentIndex: state.currentIndex
    }))
  )

export const useAudioPlayerProgressState = () =>
  useAudioPlayerStore(
    useShallow((state) => ({
      progress: state.progress,
      currentTime: state.currentTime,
      duration: state.duration
    }))
  )

export const useAudioPlayerVolumeState = () =>
  useAudioPlayerStore(
    useShallow((state) => ({
      volume: state.volume,
      isMuted: state.isMuted
    }))
  )

export type { Creator, NowPlayingContext, QueueItem }
