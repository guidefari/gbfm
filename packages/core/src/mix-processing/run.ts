import { Effect } from 'effect'
import { MixProcessingConfig } from './config'
import type { MixFileSystemError, MixProcessingError, MixValidationError } from './errors'
import { processMix } from './processing'
import type { MixProcessingInput } from './types'

export function runMixProcessing(
  input: MixProcessingInput,
  config: { ffmpegPath: string; introAudioPath: string }
): Effect.Effect<
  { outputBuffer: Buffer; outputFormat: 'mp3' | 'mp4'; safeTitle: string },
  MixValidationError | MixProcessingError | MixFileSystemError
> {
  return processMix(input).pipe(
    Effect.provideService(MixProcessingConfig, config),
    Effect.map((result) => ({
      ...result,
      outputFormat: input.outputFormat
    }))
  )
}
