import { Context } from 'effect'

export interface MixProcessingConfig {
  readonly ffmpegPath: string
  readonly introAudioPath: string
}

export const MixProcessingConfig = Context.Service<MixProcessingConfig>(
  'MixProcessingConfig'
)
