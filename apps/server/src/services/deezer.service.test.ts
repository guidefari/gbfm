import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  DeezerInvalidInput,
  DeezerNotFound,
  makeDeezerService,
  type DeezerFetch
} from './deezer.service'

const jsonResponse = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const fetchReturning =
  (body: string): DeezerFetch =>
  () =>
    Promise.resolve(jsonResponse(body))

describe('DeezerService', () => {
  test('resolves an exact track URL into a normalized source candidate', async () => {
    const service = makeDeezerService(
      fetchReturning(
        JSON.stringify({
          id: 3135556,
          title: 'Harder Better Faster Stronger',
          duration: 224,
          link: 'https://www.deezer.com/track/3135556',
          isrc: 'GBDUW0000059',
          artist: { id: 27, name: 'Daft Punk' },
          album: {
            id: 302127,
            title: 'Discovery',
            cover_xl: 'https://example.com/discovery.jpg'
          }
        })
      )
    )

    const result = await Effect.runPromise(
      service.resolve({ entityType: 'track', source: 'https://www.deezer.com/us/track/3135556' })
    )

    expect(result).toEqual({
      platform: 'deezer',
      entityType: 'track',
      externalId: '3135556',
      url: 'https://www.deezer.com/track/3135556',
      title: 'Harder Better Faster Stronger',
      artistNames: ['Daft Punk'],
      thumbnailUrl: 'https://example.com/discovery.jpg',
      albumTitle: 'Discovery',
      durationSeconds: 224,
      identifiers: { deezerId: '3135556', isrc: 'GBDUW0000059' },
      match: 'exact_source'
    })
  })

  test('encodes the playlist exact-source invariant in the candidate', async () => {
    const service = makeDeezerService(
      fetchReturning(
        JSON.stringify({
          id: 908622995,
          title: 'On Repeat',
          link: 'https://www.deezer.com/playlist/908622995',
          description: 'Current favourites',
          picture_xl: 'https://example.com/playlist.jpg',
          duration: 3600,
          nb_tracks: 20,
          creator: { name: 'Listener' }
        })
      )
    )

    const result = await Effect.runPromise(
      service.resolve({ entityType: 'playlist', source: '908622995' })
    )

    expect(result).toMatchObject({
      entityType: 'playlist',
      externalId: '908622995',
      match: 'exact_source',
      crossPlatformMatching: 'prohibited'
    })
  })

  test('resolves an exact album ID', async () => {
    const service = makeDeezerService(
      fetchReturning(
        JSON.stringify({
          id: 302127,
          title: 'Discovery',
          link: 'https://www.deezer.com/album/302127',
          cover_xl: 'https://example.com/discovery.jpg',
          release_date: '2001-03-07',
          nb_tracks: 14,
          artist: { id: 27, name: 'Daft Punk' }
        })
      )
    )

    const result = await Effect.runPromise(
      service.resolve({ entityType: 'album', source: '302127' })
    )

    expect(result).toMatchObject({
      entityType: 'album',
      externalId: '302127',
      title: 'Discovery',
      artistNames: ['Daft Punk'],
      match: 'exact_source'
    })
  })

  test('matches a track search only when the returned ISRC is exact', async () => {
    const service = makeDeezerService(
      fetchReturning(
        JSON.stringify({
          data: [
            {
              id: 1,
              title: 'Wrong recording',
              duration: 180,
              link: 'https://www.deezer.com/track/1',
              isrc: 'WRONG123',
              artist: { id: 2, name: 'Artist' },
              album: { id: 3, title: 'Album' }
            },
            {
              id: 4,
              title: 'Exact recording',
              duration: 181,
              link: 'https://www.deezer.com/track/4',
              isrc: 'GB-AAA-12-34567',
              artist: { id: 2, name: 'Artist' },
              album: { id: 3, title: 'Album' }
            }
          ]
        })
      )
    )

    const result = await Effect.runPromise(service.searchTrackByIsrc('gb aaa 12 34567'))

    expect(result).toMatchObject({ externalId: '4', match: 'exact_isrc' })
  })

  test('rejects a non-exact album search result after normalization', async () => {
    const service = makeDeezerService(
      fetchReturning(
        JSON.stringify({
          data: [
            {
              id: 10,
              title: 'Discovery Deluxe',
              link: 'https://www.deezer.com/album/10',
              artist: { id: 27, name: 'Daft Punk' }
            }
          ]
        })
      )
    )

    const result = await Effect.runPromise(
      service.searchAlbumByTitleArtist('Discovery', 'Daft Punk')
    )

    expect(result).toBeNull()
  })

  test('accepts an exact normalized album title and artist', async () => {
    const service = makeDeezerService(
      fetchReturning(
        JSON.stringify({
          data: [
            {
              id: 302127,
              title: 'DISCOVERY!',
              link: 'https://www.deezer.com/album/302127',
              artist: { id: 27, name: 'Daft-Punk' }
            }
          ]
        })
      )
    )

    const result = await Effect.runPromise(
      service.searchAlbumByTitleArtist('Discovery', 'Daft Punk')
    )

    expect(result).toMatchObject({ externalId: '302127', match: 'exact_metadata' })
  })

  test('fails invalid sources before making a request', async () => {
    let requestCount = 0
    const fetcher: DeezerFetch = () => {
      requestCount += 1
      return Promise.resolve(jsonResponse('{}'))
    }
    const service = makeDeezerService(fetcher)

    const error = await Effect.runPromise(
      Effect.flip(
        service.resolve({ entityType: 'playlist', source: 'https://open.spotify.com/playlist/12' })
      )
    )

    expect(error).toBeInstanceOf(DeezerInvalidInput)
    expect(requestCount).toBe(0)
  })

  test('maps a missing exact source to a typed not-found error', async () => {
    const service = makeDeezerService(() => Promise.resolve(jsonResponse('{}', 404)))

    const error = await Effect.runPromise(
      Effect.flip(service.resolve({ entityType: 'album', source: '302127' }))
    )

    expect(error).toBeInstanceOf(DeezerNotFound)
  })

  test('propagates the caller abort signal to fetch', async () => {
    const controller = new AbortController()
    const receivedSignals: AbortSignal[] = []
    const fetcher: DeezerFetch = (_input, init) => {
      if (init?.signal) receivedSignals.push(init.signal)
      return Promise.resolve(
        jsonResponse(
          JSON.stringify({
            id: 1,
            title: 'Album',
            link: 'https://www.deezer.com/album/1',
            artist: { id: 2, name: 'Artist' }
          })
        )
      )
    }
    const service = makeDeezerService(fetcher)

    await Effect.runPromise(
      service.resolve({ entityType: 'album', source: '1', signal: controller.signal })
    )

    controller.abort()
    expect(receivedSignals[0]?.aborted).toBe(true)
  })
})
