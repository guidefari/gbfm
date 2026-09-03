import { Schema } from 'effect'

export const MUSIC_SOURCE_ERROR_REASONS = [
  'invalid_url',
  'unsupported_protocol',
  'credentials',
  'control_character',
  'too_long',
  'unsafe_destination',
  'invalid_provider_source',
  'type_mismatch',
  'digest_failed'
] as const

export type MusicSourceErrorReason = (typeof MUSIC_SOURCE_ERROR_REASONS)[number]

export class MusicSourceInvalid extends Schema.TaggedError<MusicSourceInvalid>()(
  'MusicSourceInvalid',
  {
    reason: Schema.Literals(MUSIC_SOURCE_ERROR_REASONS),
    message: Schema.String
  }
) {}
