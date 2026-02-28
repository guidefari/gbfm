import { Context, Effect, Layer } from 'effect'
import ffmpeg from 'ffmpeg-static'
import {
  type MixProcessingInput,
  type JobInfo,
  MixProcessingConfig,
  MixJobQueue,
  makeInMemoryJobQueue,
  processMix
} from '@gbfm/core/mix-processing'
import { config } from './config.service'
import { S3Service } from './s3.service'

export interface MixProcessingService {
  readonly submitJob: (
    jobId: string,
    input: MixProcessingInput
  ) => Effect.Effect<void, never, never>
  readonly getJobStatus: (jobId: string) => Effect.Effect<JobInfo | undefined>
}

export const MixProcessingService = Context.GenericTag<MixProcessingService>(
  'MixProcessingService'
)

const MixJobQueueLive = Layer.effect(MixJobQueue, makeInMemoryJobQueue)

export const MixProcessingServiceLive = Layer.effect(
  MixProcessingService,
  Effect.gen(function* () {
    const jobQueue = yield* MixJobQueue
    const s3 = yield* S3Service

    return MixProcessingService.of({
      submitJob: (jobId, input) =>
        Effect.gen(function* () {
          yield* jobQueue.submit(jobId)

          yield* Effect.gen(function* () {
            yield* jobQueue.updateStatus(jobId, { _tag: 'Processing' })
            yield* Effect.logInfo('[MixProcessing] Job started', { jobId })

            const result = yield* processMix(input)

            const s3Key = `processed-mixes/${jobId}/${result.safeTitle}.${result.outputFormat}`
            const contentType =
              result.outputFormat === 'mp3' ? 'audio/mpeg' : 'video/mp4'
            const bucketName = config.buckets.userContent
            yield* s3.uploadFile(
              s3Key,
              result.outputBuffer,
              contentType,
              bucketName
            )

            const outputUrl = `https://cdn.goosebumps.fm/${s3Key}`
            yield* jobQueue.updateStatus(jobId, {
              _tag: 'Completed',
              outputUrl
            })
            yield* Effect.logInfo('[MixProcessing] Job completed', {
              jobId,
              outputUrl
            })
          }).pipe(
            Effect.provideService(MixProcessingConfig, {
              ffmpegPath: ffmpeg as string,
              introAudioPath: 'public/intro.wav'
            }),
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                const errorMessage =
                  '_tag' in error && 'message' in error
                    ? (error as { message: string }).message
                    : 'Unknown error'
                yield* jobQueue.updateStatus(jobId, {
                  _tag: 'Failed',
                  error: errorMessage
                })
                yield* Effect.logError('[MixProcessing] Job failed', {
                  jobId,
                  error: errorMessage
                })
              })
            ),
            Effect.forkDaemon
          )
        }),

      getJobStatus: (jobId) => jobQueue.getStatus(jobId)
    })
  })
)

export const MixProcessingServiceLayer = MixProcessingServiceLive.pipe(
  Layer.provide(MixJobQueueLive)
)
