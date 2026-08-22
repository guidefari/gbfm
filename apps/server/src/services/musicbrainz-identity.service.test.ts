import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  makeMusicBrainzIdentityService,
  MusicBrainzNotFound,
  type MusicBrainzFetch
} from './musicbrainz-identity.service'

const requestedRecordingMbid = '11111111-1111-4111-8111-111111111111'
const canonicalRecordingMbid = '22222222-2222-4222-8222-222222222222'
const releaseMbid = '33333333-3333-4333-8333-333333333333'
const releaseGroupMbid = '44444444-4444-4444-8444-444444444444'

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

const jsonResponse = (value: JsonValue, status = 200, url?: string) => {
  const response = new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
  if (url) Object.defineProperty(response, 'url', { value })
  return response
}

const makeService = (fetcher: MusicBrainzFetch) =>
  Effect.runPromise(
    makeMusicBrainzIdentityService(fetcher, {
      requestIntervalMs: 0,
      maxRetries: 0
    })
  )

describe('MusicBrainzIdentityService', () => {
  test('resolves an exact ISRC only when the response contains that ISRC', async () => {
    const service = await makeService(() =>
      Promise.resolve(
        jsonResponse({
          recordings: [
            {
              id: canonicalRecordingMbid,
              title: 'Exact recording',
              isrcs: ['GB-AAA-12-34567'],
              length: 183000,
              'artist-credit': [{ name: 'Artist' }]
            }
          ]
        })
      )
    )

    const result = await Effect.runPromise(service.lookupRecordingByIsrc('gb aaa 12 34567'))

    expect(result).toMatchObject({
      entityType: 'track',
      recordingMbid: canonicalRecordingMbid,
      isrcs: ['GB-AAA-12-34567'],
      provenance: {
        source: 'musicbrainz',
        confidence: 'exact_isrc',
        canonicalMbid: canonicalRecordingMbid
      }
    })
    expect(result.provenance.lookupAt).toEqual(expect.any(String))
  })

  test('does not accept an ISRC endpoint result without an exact normalized ISRC', async () => {
    const service = await makeService(() =>
      Promise.resolve(
        jsonResponse({
          recordings: [
            {
              id: canonicalRecordingMbid,
              title: 'Other recording',
              isrcs: ['US-WRONG-1']
            }
          ]
        })
      )
    )

    const error = await Effect.runPromise(
      Effect.flip(service.lookupRecordingByIsrc('GB-AAA-12-34567'))
    )

    expect(error).toBeInstanceOf(MusicBrainzNotFound)
  })

  test('models album identity and edition evidence separately', async () => {
    const service = await makeService(() =>
      Promise.resolve(
        jsonResponse({
          id: releaseMbid,
          title: 'Album, UK edition',
          country: 'GB',
          date: '2020-01-02',
          barcode: '123456789',
          'artist-credit': [{ name: 'Artist' }],
          'release-group': {
            id: releaseGroupMbid,
            title: 'Album',
            'primary-type': 'Album'
          }
        })
      )
    )

    const result = await Effect.runPromise(
      service.lookupByMbid({ mbidType: 'release', mbid: releaseMbid })
    )

    expect(result).toMatchObject({
      entityType: 'album',
      title: 'Album',
      releaseGroup: { mbid: releaseGroupMbid, primaryType: 'Album' },
      editionRelease: {
        mbid: releaseMbid,
        country: 'GB',
        date: '2020-01-02',
        barcode: '123456789'
      }
    })
  })

  test('records a redirected recording MBID as canonical while retaining provenance', async () => {
    const service = await makeService(() =>
      Promise.resolve(
        jsonResponse(
          {
            id: canonicalRecordingMbid,
            title: 'Canonical recording',
            isrcs: []
          },
          200,
          `https://musicbrainz.org/ws/2/recording/${canonicalRecordingMbid}?fmt=json`
        )
      )
    )

    const result = await Effect.runPromise(
      service.lookupByMbid({
        mbidType: 'recording',
        mbid: requestedRecordingMbid
      })
    )

    expect(result).toMatchObject({
      entityType: 'track',
      recordingMbid: canonicalRecordingMbid,
      provenance: {
        requestedMbid: requestedRecordingMbid,
        canonicalMbid: canonicalRecordingMbid,
        confidence: 'exact_mbid'
      }
    })
  })

  test('returns text matches as candidates without an accepted match state', async () => {
    const service = await makeService(() =>
      Promise.resolve(
        jsonResponse({
          recordings: [
            {
              id: requestedRecordingMbid,
              title: 'Song',
              'artist-credit': [{ name: 'Artist' }]
            },
            {
              id: canonicalRecordingMbid,
              title: 'Song',
              'artist-credit': [{ name: 'Artist' }]
            }
          ]
        })
      )
    )

    const results = await Effect.runPromise(
      service.searchCandidates({
        entityType: 'track',
        title: 'Song',
        artistName: 'Artist'
      })
    )

    expect(results).toHaveLength(2)
    expect(results.every((candidate) => candidate.provenance.confidence === 'candidate')).toBe(true)
  })

  test('resolves an exact canonical Spotify URL relationship', async () => {
    const service = await makeService(() =>
      Promise.resolve(
        jsonResponse({
          resource: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh',
          relations: [
            {
              recording: {
                id: canonicalRecordingMbid,
                title: 'URL matched recording',
                'artist-credit': [{ name: 'Artist' }]
              }
            }
          ]
        })
      )
    )

    const result = await Effect.runPromise(
      service.lookupByExternalUrl({
        entityType: 'track',
        url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh?si=ignored'
      })
    )

    expect(result).toMatchObject({
      entityType: 'track',
      recordingMbid: canonicalRecordingMbid,
      provenance: {
        confidence: 'exact_url',
        matchedUrl: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
      }
    })
  })

  test('does not auto-accept an ambiguous exact URL relationship', async () => {
    const service = await makeService(() =>
      Promise.resolve(
        jsonResponse({
          resource: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh',
          relations: [
            { recording: { id: requestedRecordingMbid, title: 'First' } },
            { recording: { id: canonicalRecordingMbid, title: 'Second' } }
          ]
        })
      )
    )

    const error = await Effect.runPromise(
      Effect.flip(
        service.lookupByExternalUrl({
          entityType: 'track',
          url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
        })
      )
    )

    expect(error).toBeInstanceOf(MusicBrainzNotFound)
  })

  test('returns remote Cover Art Archive provenance without asserting image rights', async () => {
    const service = await makeService(() =>
      Promise.resolve(
        jsonResponse({
          release: `https://musicbrainz.org/release/${releaseMbid}`,
          images: [
            {
              image: `https://coverartarchive.org/release/${releaseMbid}/1.jpg`,
              front: true,
              approved: true,
              thumbnails: {
                '500': `https://coverartarchive.org/release/${releaseMbid}/1-500.jpg`
              }
            }
          ]
        })
      )
    )

    const result = await Effect.runPromise(service.lookupCoverArt(releaseMbid))

    expect(result).toMatchObject({
      imageUrl: `https://coverartarchive.org/release/${releaseMbid}/1-500.jpg`,
      source: 'cover_art_archive',
      releaseMbid,
      archiveUrl: `https://coverartarchive.org/release/${releaseMbid}`,
      approved: true,
      rights: 'not_asserted',
      storage: 'remote_reference'
    })
  })

  test('serializes requests across independently constructed service instances', async () => {
    const starts: number[] = []
    const fetcher: MusicBrainzFetch = () => {
      starts.push(performance.now())
      return Promise.resolve(
        jsonResponse({
          id: requestedRecordingMbid,
          title: 'Recording',
          isrcs: []
        })
      )
    }
    const options = { requestIntervalMs: 30, maxRetries: 0 }
    const first = await Effect.runPromise(makeMusicBrainzIdentityService(fetcher, options))
    const second = await Effect.runPromise(makeMusicBrainzIdentityService(fetcher, options))

    await Promise.all([
      Effect.runPromise(
        first.lookupByMbid({
          mbidType: 'recording',
          mbid: requestedRecordingMbid
        })
      ),
      Effect.runPromise(
        second.lookupByMbid({
          mbidType: 'recording',
          mbid: canonicalRecordingMbid
        })
      )
    ])

    expect(starts).toHaveLength(2)
    expect((starts[1] ?? 0) - (starts[0] ?? 0)).toBeGreaterThanOrEqual(25)
  })

  test('sends a contactable user agent and retries a transient response', async () => {
    const headers: string[] = []
    let count = 0
    const service = await Effect.runPromise(
      makeMusicBrainzIdentityService(
        (_input, init) => {
          headers.push(
            new Request('https://example.com', {
              headers: init?.headers
            }).headers.get('User-Agent') ?? ''
          )
          count += 1
          return Promise.resolve(
            count === 1
              ? jsonResponse({}, 503)
              : jsonResponse({
                  id: requestedRecordingMbid,
                  title: 'Song',
                  isrcs: []
                })
          )
        },
        {
          requestIntervalMs: 0,
          maxRetries: 1,
          userAgent: 'gbfm-test/1 (dev@example.com)'
        }
      )
    )

    await Effect.runPromise(
      service.lookupByMbid({
        mbidType: 'recording',
        mbid: requestedRecordingMbid
      })
    )

    expect(headers).toEqual(['gbfm-test/1 (dev@example.com)', 'gbfm-test/1 (dev@example.com)'])
  })

  test('caches successful and missing exact lookups', async () => {
    let foundRequests = 0
    const foundService = await makeService(() => {
      foundRequests += 1
      return Promise.resolve(jsonResponse({ id: requestedRecordingMbid, title: 'Song', isrcs: [] }))
    })
    await Effect.runPromise(
      foundService.lookupByMbid({
        mbidType: 'recording',
        mbid: requestedRecordingMbid
      })
    )
    await Effect.runPromise(
      foundService.lookupByMbid({
        mbidType: 'recording',
        mbid: requestedRecordingMbid
      })
    )

    let missingRequests = 0
    const missingService = await makeService(() => {
      missingRequests += 1
      return Promise.resolve(jsonResponse({}, 404))
    })
    for (const _iteration of [1, 2]) {
      await Effect.runPromise(
        Effect.flip(
          missingService.lookupByMbid({
            mbidType: 'recording',
            mbid: canonicalRecordingMbid
          })
        )
      )
    }

    expect(foundRequests).toBe(1)
    expect(missingRequests).toBe(1)
  })
})
