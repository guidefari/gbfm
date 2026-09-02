import { Effect, Exit } from 'effect'
import { describe, expect, test } from 'vitest'
import { decodeQrPdfRequest } from './contract'

describe('QR PDF runtime contract', () => {
  test('parses a valid generation command', async () => {
    const decoded = await Effect.runPromise(
      decodeQrPdfRequest({
        kind: 'show',
        slug: 'deep-cuts',
        title: 'Deep Cuts',
        people: ['Guide Fari']
      })
    )

    expect(decoded.kind).toBe('show')
  })

  test('rejects malformed runtime-hop input', async () => {
    const exit = await Effect.runPromiseExit(
      decodeQrPdfRequest({ kind: 'playlist', slug: '', title: 'Bad request' })
    )

    expect(Exit.isFailure(exit)).toBe(true)
  })
})
