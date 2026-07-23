import { Exit, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { AudioResponse, CreateAudioInput } from './audio'

const createInput = {
  title: 'Test mix',
  slug: 'test-mix',
  content: '',
  type: 'mix',
  url: 'https://example.com/audio.mp3'
} as const

describe('audio API contract', () => {
  it('requires a UUID idempotency key for creates', () => {
    const missing = Schema.decodeUnknownExit(CreateAudioInput)(createInput)
    const invalid = Schema.decodeUnknownExit(CreateAudioInput)({
      ...createInput,
      idempotencyKey: 'not-a-uuid'
    })
    const valid = Schema.decodeUnknownExit(CreateAudioInput)({
      ...createInput,
      idempotencyKey: 'fd501dca-d3f4-4267-a5a8-53d28ac8a7f4'
    })

    expect(Exit.isFailure(missing)).toBe(true)
    expect(Exit.isFailure(invalid)).toBe(true)
    expect(Exit.isSuccess(valid)).toBe(true)
  })

  it('does not expose persistence idempotency fields in audio responses', () => {
    const decoded = Schema.decodeUnknownSync(AudioResponse)({
      id: 'audio-1',
      title: 'Test mix',
      description: null,
      thumbnailUrl: null,
      slug: 'test-mix',
      content: '',
      draft: false,
      tags: null,
      type: 'mix',
      url: 'https://example.com/audio.mp3',
      showId: null,
      episodeNumber: null,
      playCount: 0,
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T00:00:00.000Z',
      idempotencyKey: 'fd501dca-d3f4-4267-a5a8-53d28ac8a7f4',
      idempotencyActorId: 'actor-1'
    })

    expect(decoded).not.toHaveProperty('idempotencyKey')
    expect(decoded).not.toHaveProperty('idempotencyActorId')
  })
})
