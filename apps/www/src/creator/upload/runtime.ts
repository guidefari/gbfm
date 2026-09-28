import { Context, Effect, Layer, Queue, Stream } from 'effect'

import { AlreadyInProgressError, InvalidResponseError, type ResumableUploadError } from './errors'
import { cancelProgram, uploadProgram, type UploadProgress } from './program'
import { computeFileFingerprint } from './protocol'
import { ResumableUploadStorage, ResumableUploadStorageLive } from './storage'

export class CreatorUpload extends Context.Service<
  CreatorUpload,
  {
    readonly start: (file: File) => Effect.Effect<string, ResumableUploadError>
    readonly resume: Effect.Effect<string, ResumableUploadError>
    readonly pause: Effect.Effect<void>
    readonly cancel: Effect.Effect<void, ResumableUploadError>
    readonly progress: Stream.Stream<UploadProgress>
  }
>()('@gbfm/www/CreatorUpload') {}

export const CreatorUploadLive = Layer.effect(
  CreatorUpload,
  Effect.gen(function* () {
    const storage = yield* ResumableUploadStorage
    const listeners = new Set<(progress: UploadProgress) => void>()
    let file: File | null = null
    let active: AbortController | null = null
    let paused = false

    yield* Effect.addFinalizer(() => Effect.sync(() => active?.abort()))

    const start = Effect.fn('CreatorUpload.start')(function* (selected: File) {
      if (active)
        return yield* new AlreadyInProgressError({ message: 'An upload is already running.' })
      const controller = new AbortController()
      active = controller
      file = selected
      paused = false

      return yield* Effect.gen(function* () {
        const checkpoint = yield* storage.read(computeFileFingerprint(selected))

        const result = yield* uploadProgram(
          { file: selected, fileType: 'audio' },
          {
            signal: controller.signal,
            isPaused: () => paused,
            onCheckpoint: () => {},
            onProgress: (progress) => listeners.forEach((listener) => listener(progress)),
            checkpoint: checkpoint ?? undefined,
          },
        )

        file = null

        return result.url
      }).pipe(
        Effect.provideService(ResumableUploadStorage, storage),
        Effect.ensuring(
          Effect.sync(() => {
            controller.abort()
            active = null
          }),
        ),
      )
    })

    return CreatorUpload.of({
      start,
      resume: Effect.gen(function* () {
        if (!file)
          return yield* new InvalidResponseError({
            message: 'Select the original audio file to resume.',
          })

        return yield* start(file)
      }).pipe(Effect.withSpan('CreatorUpload.resume')),
      pause: Effect.sync(() => {
        paused = true
      }),
      cancel: Effect.gen(function* () {
        if (active)
          return yield* new AlreadyInProgressError({
            message: 'Pause the upload before cancelling.',
          })

        if (file) {
          const checkpoint = yield* storage.read(computeFileFingerprint(file))

          if (checkpoint)
            yield* cancelProgram(checkpoint, new AbortController().signal).pipe(
              Effect.provideService(ResumableUploadStorage, storage),
            )
        }

        file = null

        return undefined
      }).pipe(Effect.withSpan('CreatorUpload.cancel')),
      progress: Stream.callback<UploadProgress>((queue) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const listener = (progress: UploadProgress) => {
              Queue.offerUnsafe(queue, progress)
            }

            listeners.add(listener)

            return listener
          }),
          (listener) =>
            Effect.sync(() => {
              listeners.delete(listener)
            }),
        ),
      ),
    })
  }),
).pipe(Layer.provide(ResumableUploadStorageLive))
