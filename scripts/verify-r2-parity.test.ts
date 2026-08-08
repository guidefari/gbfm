import { createHash } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import {
  compareContentHashSample,
  compareInventories,
  type ObjectInventory
} from './verify-r2-parity'

const metadata = (contentType: string) => ({
  cacheControl: null,
  contentDisposition: null,
  contentEncoding: null,
  contentLanguage: null,
  contentType,
  expires: null,
  custom: {}
})

const object = (key: string, size: number, contentType = 'audio/mpeg'): ObjectInventory => ({
  key,
  size,
  metadata: metadata(contentType)
})

const keySha256 = (key: string) => createHash('sha256').update(key).digest('hex')

describe('parity comparison', () => {
  test('reports seeded content divergence without exposing the key or hashes', () => {
    const result = compareContentHashSample([
      {
        key: 'diverged.mp3',
        sourceSha256: 'source-content-hash',
        destinationSha256: 'destination-content-hash'
      },
      {
        key: 'matching.mp3',
        sourceSha256: 'matching-content-hash',
        destinationSha256: 'matching-content-hash'
      }
    ])

    expect(result).toEqual([{ keySha256: keySha256('diverged.mp3') }])
    expect(JSON.stringify(result)).not.toContain('diverged.mp3')
    expect(JSON.stringify(result)).not.toContain('content-hash')
  })

  test('reports seeded size, metadata, missing, and unexpected divergences with redacted keys', () => {
    const result = compareInventories(
      [object('same.mp3', 10), object('changed.mp3', 20), object('missing.mp3', 30)],
      [
        object('same.mp3', 10),
        object('changed.mp3', 21, 'application/octet-stream'),
        object('unexpected.mp3', 40)
      ]
    )

    expect(result).toEqual({
      source: { objectCount: 3, totalBytes: 60 },
      destination: { objectCount: 3, totalBytes: 71 },
      mismatches: [
        {
          kind: 'Size',
          keySha256: keySha256('changed.mp3'),
          source: 20,
          destination: 21
        },
        {
          kind: 'Metadata',
          keySha256: keySha256('changed.mp3'),
          fields: ['contentType']
        },
        {
          kind: 'MissingFromDestination',
          keySha256: keySha256('missing.mp3')
        },
        {
          kind: 'UnexpectedInDestination',
          keySha256: keySha256('unexpected.mp3')
        }
      ]
    })
    expect(JSON.stringify(result)).not.toContain('changed.mp3')
    expect(JSON.stringify(result)).not.toContain('missing.mp3')
    expect(JSON.stringify(result)).not.toContain('unexpected.mp3')
  })
})
