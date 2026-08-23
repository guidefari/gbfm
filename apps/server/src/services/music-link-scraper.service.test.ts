import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { MusicProviderInvalidInput, MusicProviderNotFound } from '@/errors'
import {
  type CrossPlatformLinkDiscovery,
  type MusicDataProvider,
  MusicScraperError,
  makeMusicLinkScraperService,
  type ProviderResult
} from './music-link-scraper.service'
import type { DeezerService } from './deezer.service'
import {
  MusicBrainzNotFound,
  MusicBrainzRequestFailed,
  type MusicBrainzIdentityCandidate,
  type MusicBrainzIdentityServiceContract
} from './musicbrainz-identity.service'
import type { SpotifyService } from './spotify.service'

const unavailableOdesli: CrossPlatformLinkDiscovery = {
  name: 'odesli',
  discoverLinks: () =>
    Effect.fail(
      new MusicScraperError({
        message: 'Odesli unavailable',
        provider: 'odesli',
        statusCode: 502
      })
    )
}

const spotify: SpotifyService = {
  getTrack: () =>
    Effect.succeed({
      albumType: 'album',
      albumImageUrl: 'https://example.com/cover.jpg',
      title: 'Fallback Track',
      artists: 'Fallback Artist',
      trackUrl: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
    }),
  getAlbum: () => Effect.die('unexpected getAlbum call'),
  getPlaylist: () => Effect.die('unexpected getPlaylist call'),
  getPlaylistForImport: () => Effect.die('unexpected getPlaylistForImport call'),
  getTrackForImport: () => Effect.die('unexpected getTrackForImport call'),
  searchAlbums: () => Effect.die('unexpected searchAlbums call'),
  searchTrackByIsrc: () => Effect.succeed(null),
  searchAlbumByTitleArtist: () => Effect.succeed(null),
  enrichTrackFromUrl: () => Effect.die('unexpected enrichTrackFromUrl call'),
  resolveSource: ({ entityType }) =>
    entityType === 'playlist'
      ? Effect.succeed({
          platform: 'spotify',
          entityType: 'playlist',
          externalId: '4iV5W9uYEdYUVa79Axb7Rh',
          title: 'Source Playlist',
          url: 'https://open.spotify.com/playlist/4iV5W9uYEdYUVa79Axb7Rh',
          ownerName: 'Owner',
          crossPlatformEnrichment: 'forbidden'
        })
      : Effect.succeed({
          platform: 'spotify',
          entityType: 'track',
          externalId: '4iV5W9uYEdYUVa79Axb7Rh',
          title: 'Fallback Track',
          artists: 'Fallback Artist',
          url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh',
          imageUrl: 'https://example.com/cover.jpg',
          crossPlatformEnrichment: 'allowed'
        })
}

const deezer: DeezerService = {
  resolve: () => Effect.die('unexpected Deezer resolve call'),
  searchTrackByIsrc: () => Effect.succeed(null),
  searchAlbumByTitleArtist: () => Effect.succeed(null)
}

const musicbrainz: MusicBrainzIdentityServiceContract = {
  lookupByMbid: () => Effect.die('unexpected MusicBrainz MBID lookup'),
  lookupRecordingByIsrc: (isrc) =>
    Effect.fail(
      new MusicBrainzNotFound({
        operation: 'lookupRecordingByIsrc',
        identifier: isrc
      })
    ),
  lookupByExternalUrl: ({ url }) =>
    Effect.fail(
      new MusicBrainzNotFound({
        operation: 'lookupByExternalUrl',
        identifier: url
      })
    ),
  lookupCoverArt: (releaseMbid) =>
    Effect.fail(
      new MusicBrainzNotFound({
        operation: 'lookupCoverArt',
        identifier: releaseMbid
      })
    ),
  searchCandidates: () => Effect.die('unexpected MusicBrainz search')
}

describe('makeMusicLinkScraperService', () => {
  test('falls back to Spotify track metadata when Odesli is unavailable', async () => {
    const scraper = makeMusicLinkScraperService([], spotify, deezer, musicbrainz, unavailableOdesli)

    const result = await Effect.runPromise(
      scraper.scrape({
        url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
      })
    )

    expect(result).toEqual({
      links: [
        {
          platform: 'spotify',
          url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh',
          scrapedAt: expect.any(Date),
          metadata: {
            discoveredBy: 'spotify',
            confidence: 'exact_source',
            externalId: '4iV5W9uYEdYUVa79Axb7Rh'
          }
        }
      ],
      entityMeta: {
        title: 'Fallback Track',
        artistName: 'Fallback Artist',
        thumbnailUrl: 'https://example.com/cover.jpg',
        type: 'song'
      }
    })
  })

  test('keeps successful provider results when another provider fails', async () => {
    const successfulProvider: MusicDataProvider = {
      name: 'bandcamp',
      fetchLinks: () =>
        Effect.succeed({
          links: [
            {
              platform: 'bandcamp',
              url: 'https://artist.bandcamp.com/track/example',
              scrapedAt: new Date('2026-08-16T00:00:00.000Z')
            }
          ],
          entityMeta: {
            title: 'Example',
            artistName: 'Artist',
            type: 'song'
          }
        } satisfies ProviderResult)
    }
    const scraper = makeMusicLinkScraperService(
      [successfulProvider],
      spotify,
      deezer,
      musicbrainz,
      unavailableOdesli
    )

    const result = await Effect.runPromise(
      scraper.scrape({ url: 'https://artist.bandcamp.com/track/example' })
    )

    expect(result).toEqual({
      links: [
        {
          platform: 'bandcamp',
          url: 'https://artist.bandcamp.com/track/example',
          scrapedAt: new Date('2026-08-16T00:00:00.000Z')
        }
      ],
      entityMeta: {
        title: 'Example',
        artistName: 'Artist',
        type: 'song'
      }
    })
  })

  test('keeps exact Deezer source metadata when Odesli is unavailable', async () => {
    const lookedUpIsrcs: string[] = []
    const sourceDeezer: DeezerService = {
      ...deezer,
      resolve: () =>
        Effect.succeed({
          platform: 'deezer',
          entityType: 'track',
          externalId: '3135556',
          url: 'https://www.deezer.com/track/3135556',
          title: 'Deezer Source',
          artistNames: ['Source Artist'],
          thumbnailUrl: 'https://example.com/deezer.jpg',
          albumTitle: 'Source Album',
          durationSeconds: 180,
          identifiers: { deezerId: '3135556', isrc: 'GBUM71029604' },
          match: 'exact_source'
        })
    }
    const recordingMusicBrainz: MusicBrainzIdentityServiceContract = {
      ...musicbrainz,
      lookupRecordingByIsrc: (isrc) => {
        lookedUpIsrcs.push(isrc)
        return Effect.fail(
          new MusicBrainzNotFound({
            operation: 'lookupRecordingByIsrc',
            identifier: isrc
          })
        )
      }
    }
    const scraper = makeMusicLinkScraperService(
      [],
      spotify,
      sourceDeezer,
      recordingMusicBrainz,
      unavailableOdesli
    )

    const result = await Effect.runPromise(
      scraper.scrape({
        entityType: 'track',
        url: 'https://www.deezer.com/track/3135556'
      })
    )

    expect(result.entityMeta).toEqual({
      title: 'Deezer Source',
      artistName: 'Source Artist',
      thumbnailUrl: 'https://example.com/deezer.jpg',
      type: 'song',
      isrc: 'GBUM71029604'
    })
    expect(lookedUpIsrcs).toEqual(['GBUM71029604'])
    expect(result.links).toEqual([
      {
        platform: 'deezer',
        url: 'https://www.deezer.com/track/3135556',
        scrapedAt: expect.any(Date),
        metadata: {
          discoveredBy: 'deezer',
          confidence: 'exact_source',
          externalId: '3135556'
        }
      }
    ])
  })

  test('enriches an exact Deezer track through Odesli without replacing source data', async () => {
    const sourceDeezer: DeezerService = {
      ...deezer,
      resolve: () =>
        Effect.succeed({
          platform: 'deezer',
          entityType: 'track',
          externalId: '3135556',
          url: 'https://www.deezer.com/track/3135556',
          title: 'Exact Source Title',
          artistNames: ['Exact Source Artist'],
          albumTitle: 'Source Album',
          durationSeconds: 180,
          identifiers: { deezerId: '3135556', isrc: 'GBUM71029604' },
          match: 'exact_source'
        })
    }
    const odesli: CrossPlatformLinkDiscovery = {
      name: 'odesli',
      discoverLinks: () =>
        Effect.succeed({
          links: [
            {
              platform: 'spotify',
              url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh',
              scrapedAt: new Date('2026-08-16T00:00:00.000Z')
            },
            {
              platform: 'deezer',
              url: 'https://www.deezer.com/track/wrong',
              scrapedAt: new Date('2026-08-16T00:00:00.000Z')
            }
          ],
          entityMeta: {
            title: 'Odesli Title',
            artistName: 'Odesli Artist',
            type: 'song'
          }
        })
    }
    const scraper = makeMusicLinkScraperService([], spotify, sourceDeezer, musicbrainz, odesli)

    const result = await Effect.runPromise(
      scraper.scrape({
        entityType: 'track',
        url: 'https://www.deezer.com/track/3135556'
      })
    )

    expect(result.entityMeta?.title).toBe('Exact Source Title')
    expect(result.links.map(({ platform, url }) => ({ platform, url }))).toEqual([
      { platform: 'deezer', url: 'https://www.deezer.com/track/3135556' },
      {
        platform: 'spotify',
        url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
      }
    ])
  })

  test('only invokes the exact source service for playlists', async () => {
    const calls: string[] = []
    const provider = (name: string): MusicDataProvider => ({
      name,
      fetchLinks: () => {
        calls.push(name)
        return Effect.succeed({
          links:
            name === 'spotify'
              ? [
                  {
                    platform: 'spotify',
                    url: 'https://open.spotify.com/playlist/source',
                    scrapedAt: new Date('2026-08-16T00:00:00.000Z')
                  }
                ]
              : []
        })
      }
    })
    const scraper = makeMusicLinkScraperService(
      [provider('odesli'), provider('musicbrainz'), provider('spotify'), provider('deezer')],
      spotify,
      deezer,
      musicbrainz
    )

    const result = await Effect.runPromise(
      scraper.scrape({
        entityType: 'playlist',
        url: 'https://open.spotify.com/playlist/4iV5W9uYEdYUVa79Axb7Rh',
        mbid: '12345678-1234-4234-8234-123456789abc',
        isrc: 'GBUM71029604'
      })
    )

    expect(calls).toEqual([])
    expect(result.links.map(({ platform, url }) => ({ platform, url }))).toEqual([
      {
        platform: 'spotify',
        url: 'https://open.spotify.com/playlist/4iV5W9uYEdYUVa79Axb7Rh'
      }
    ])
  })

  test('does not invoke any discovery provider for an unknown playlist source', async () => {
    const calls: string[] = []
    const provider = (name: string): MusicDataProvider => ({
      name,
      fetchLinks: () => {
        calls.push(name)
        return Effect.succeed({ links: [] })
      }
    })
    const scraper = makeMusicLinkScraperService(
      [provider('odesli'), provider('musicbrainz'), provider('spotify'), provider('deezer')],
      spotify,
      deezer,
      musicbrainz
    )

    const result = await Effect.runPromise(
      scraper.scrape({
        entityType: 'playlist',
        url: 'https://example.com/playlist/source'
      })
    )

    expect(calls).toEqual([])
    expect(result).toEqual({ links: [], entityMeta: undefined })
  })

  test('fails a mismatched exact source without invoking Odesli', async () => {
    const calls: string[] = []
    const mismatchSpotify: SpotifyService = {
      ...spotify,
      resolveSource: () =>
        Effect.fail(
          new MusicProviderInvalidInput({
            message: 'Mismatched Spotify source type',
            operation: 'resolveSource'
          })
        )
    }
    const odesli: CrossPlatformLinkDiscovery = {
      name: 'odesli',
      discoverLinks: () => {
        calls.push('odesli')
        return Effect.succeed({ links: [] })
      }
    }
    const scraper = makeMusicLinkScraperService([], mismatchSpotify, deezer, musicbrainz, odesli)

    const error = await Effect.runPromise(
      Effect.flip(
        scraper.scrape({
          entityType: 'album',
          url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
        })
      )
    )

    expect(error).toMatchObject({ provider: 'spotify', statusCode: 400 })
    expect(calls).toEqual([])
  })

  test('reports a missing provider entity as not found rather than unavailable', async () => {
    const missingSpotify: SpotifyService = {
      ...spotify,
      resolveSource: () =>
        Effect.fail(
          new MusicProviderNotFound({
            operation: 'getTrack',
            entityType: 'track',
            externalId: '4iV5W9uYEdYUVa79Axb7Rh'
          })
        )
    }
    const scraper = makeMusicLinkScraperService([], missingSpotify, deezer, musicbrainz)

    const error = await Effect.runPromise(
      Effect.flip(
        scraper.scrape({
          entityType: 'track',
          url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
        })
      )
    )

    expect(error).toMatchObject({ provider: 'spotify', statusCode: 404 })
  })

  test('fails with a typed unavailable error when every applicable provider fails', async () => {
    const secondUnavailable: MusicDataProvider = {
      name: 'second',
      fetchLinks: () =>
        Effect.fail(
          new MusicScraperError({
            message: 'Second unavailable',
            provider: 'second',
            statusCode: 502
          })
        )
    }
    const scraper = makeMusicLinkScraperService(
      [secondUnavailable],
      spotify,
      deezer,
      musicbrainz,
      unavailableOdesli
    )

    const error = await Effect.runPromise(
      Effect.flip(scraper.scrape({ url: 'https://example.com' }))
    )

    expect(error).toEqual(
      new MusicScraperError({
        message: 'All applicable music providers are unavailable',
        provider: 'all',
        statusCode: 503
      })
    )
  })

  test('attaches an exact recording MBID with provenance', async () => {
    const candidate: MusicBrainzIdentityCandidate = {
      source: 'musicbrainz',
      entityType: 'track',
      title: 'Exact Recording',
      artistNames: ['Exact Artist'],
      recordingMbid: '12345678-1234-4234-8234-123456789abc',
      isrcs: ['GBUM71029604'],
      provenance: {
        source: 'musicbrainz',
        confidence: 'exact_mbid',
        lookupAt: '2026-08-16T00:00:00.000Z',
        canonicalMbid: '12345678-1234-4234-8234-123456789abc'
      }
    }
    const exactMusicBrainz: MusicBrainzIdentityServiceContract = {
      ...musicbrainz,
      lookupByMbid: () => Effect.succeed(candidate)
    }
    const scraper = makeMusicLinkScraperService([], spotify, deezer, exactMusicBrainz)

    const result = await Effect.runPromise(
      scraper.scrape({
        entityType: 'track',
        mbid: '12345678-1234-4234-8234-123456789abc'
      })
    )

    expect(result).toEqual({
      links: [
        {
          platform: 'musicbrainz',
          url: 'https://musicbrainz.org/recording/12345678-1234-4234-8234-123456789abc',
          scrapedAt: new Date('2026-08-16T00:00:00.000Z'),
          metadata: {
            discoveredBy: 'musicbrainz',
            confidence: 'exact_mbid',
            mbid: '12345678-1234-4234-8234-123456789abc',
            mbidType: 'recording',
            lookupAt: '2026-08-16T00:00:00.000Z',
            canonicalMbid: '12345678-1234-4234-8234-123456789abc',
            matchedIdentifiers: { isrcs: ['GBUM71029604'] }
          }
        }
      ],
      entityMeta: {
        title: 'Exact Recording',
        artistName: 'Exact Artist',
        type: 'song',
        isrc: 'GBUM71029604'
      }
    })
  })

  test('attaches a recording only when MusicBrainz confirms the exact ISRC', async () => {
    const exactMusicBrainz: MusicBrainzIdentityServiceContract = {
      ...musicbrainz,
      lookupRecordingByIsrc: () =>
        Effect.succeed({
          source: 'musicbrainz',
          entityType: 'track',
          title: 'ISRC Recording',
          artistNames: ['Artist'],
          recordingMbid: '12345678-1234-4234-8234-123456789abc',
          isrcs: ['GBUM71029604'],
          provenance: {
            source: 'musicbrainz',
            confidence: 'exact_isrc',
            lookupAt: '2026-08-16T00:00:00.000Z',
            canonicalMbid: '12345678-1234-4234-8234-123456789abc'
          }
        })
    }
    const scraper = makeMusicLinkScraperService([], spotify, deezer, exactMusicBrainz)

    const result = await Effect.runPromise(
      scraper.scrape({ entityType: 'track', isrc: 'GB-UM7-10-29604' })
    )

    expect(result.links[0]).toMatchObject({
      platform: 'musicbrainz',
      metadata: {
        confidence: 'exact_isrc',
        matchedIdentifiers: { isrcs: ['GBUM71029604'] }
      }
    })
  })

  test('uses a release-group as album identity and retains release evidence', async () => {
    const album: MusicBrainzIdentityCandidate = {
      source: 'musicbrainz',
      entityType: 'album',
      title: 'Album',
      artistNames: ['Artist'],
      releaseGroup: {
        mbid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        primaryType: 'Album'
      },
      editionRelease: {
        mbid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        country: 'ZA',
        date: '2026-08-16',
        barcode: '1234567890'
      },
      provenance: {
        source: 'musicbrainz',
        confidence: 'exact_mbid',
        lookupAt: '2026-08-16T00:00:00.000Z',
        requestedMbid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        canonicalMbid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      }
    }
    const exactMusicBrainz: MusicBrainzIdentityServiceContract = {
      ...musicbrainz,
      lookupByMbid: () => Effect.succeed(album)
    }
    const scraper = makeMusicLinkScraperService([], spotify, deezer, exactMusicBrainz)

    const result = await Effect.runPromise(
      scraper.scrape({
        entityType: 'album',
        mbid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      })
    )

    expect(result.links[0]).toMatchObject({
      platform: 'musicbrainz',
      url: 'https://musicbrainz.org/release-group/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      metadata: {
        confidence: 'exact_mbid',
        mbidType: 'release-group',
        requestedMbid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        editionRelease: {
          mbid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          country: 'ZA',
          date: '2026-08-16',
          barcode: '1234567890'
        }
      }
    })
  })

  test('does not auto-link metadata-only MusicBrainz candidates', async () => {
    const candidates: string[] = []
    const recordingMusicBrainz: MusicBrainzIdentityServiceContract = {
      ...musicbrainz,
      searchCandidates: () => {
        candidates.push('searched')
        return Effect.succeed([])
      }
    }
    const scraper = makeMusicLinkScraperService([], spotify, deezer, recordingMusicBrainz)

    const result = await Effect.runPromise(
      scraper.scrape({
        entityType: 'track',
        artistName: 'Artist',
        trackTitle: 'Track'
      })
    )

    expect(candidates).toEqual([])
    expect(result.links).toEqual([])
  })

  test('attaches an exact MusicBrainz URL relationship without text search', async () => {
    const calls: string[] = []
    const exactMusicBrainz: MusicBrainzIdentityServiceContract = {
      ...musicbrainz,
      lookupByExternalUrl: ({ url }) => {
        calls.push(`url:${url}`)
        return Effect.succeed({
          source: 'musicbrainz',
          entityType: 'track',
          title: 'Fallback Track',
          artistNames: ['Fallback Artist'],
          recordingMbid: '12345678-1234-4234-8234-123456789abc',
          isrcs: [],
          provenance: {
            source: 'musicbrainz',
            confidence: 'exact_url',
            lookupAt: '2026-08-16T00:00:00.000Z',
            canonicalMbid: '12345678-1234-4234-8234-123456789abc',
            matchedUrl: url
          }
        })
      },
      searchCandidates: () => {
        calls.push('search')
        return Effect.succeed([])
      }
    }
    const scraper = makeMusicLinkScraperService([], spotify, deezer, exactMusicBrainz)

    const result = await Effect.runPromise(
      scraper.scrape({
        entityType: 'track',
        url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
      })
    )

    expect(calls).toEqual(['url:https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'])
    expect(result.links).toContainEqual(
      expect.objectContaining({
        platform: 'musicbrainz',
        metadata: expect.objectContaining({ confidence: 'exact_url' })
      })
    )
  })

  test('uses Cover Art Archive only as a missing source artwork fallback', async () => {
    const album: MusicBrainzIdentityCandidate = {
      source: 'musicbrainz',
      entityType: 'album',
      title: 'Album',
      artistNames: ['Artist'],
      releaseGroup: { mbid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      editionRelease: { mbid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      provenance: {
        source: 'musicbrainz',
        confidence: 'exact_mbid',
        lookupAt: '2026-08-16T00:00:00.000Z',
        canonicalMbid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      }
    }
    const exactMusicBrainz: MusicBrainzIdentityServiceContract = {
      ...musicbrainz,
      lookupByMbid: () => Effect.succeed(album),
      lookupCoverArt: () =>
        Effect.succeed({
          imageUrl: 'https://coverartarchive.org/release/release-id/front-500.jpg',
          source: 'cover_art_archive',
          releaseMbid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          archiveUrl: 'https://coverartarchive.org/release/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          lookupAt: '2026-08-16T00:00:00.000Z',
          approved: true,
          rights: 'not_asserted',
          storage: 'remote_reference'
        })
    }
    const scraper = makeMusicLinkScraperService([], spotify, deezer, exactMusicBrainz)

    const result = await Effect.runPromise(
      scraper.scrape({
        entityType: 'album',
        mbid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      })
    )

    expect(result.entityMeta?.thumbnailUrl).toBe(
      'https://coverartarchive.org/release/release-id/front-500.jpg'
    )
    expect(result.links[0]?.metadata?.coverArt).toMatchObject({
      source: 'cover_art_archive',
      rights: 'not_asserted',
      storage: 'remote_reference'
    })
  })

  test('keeps an exact Spotify entity when MusicBrainz fails', async () => {
    const unavailableMusicBrainz: MusicBrainzIdentityServiceContract = {
      ...musicbrainz,
      lookupRecordingByIsrc: () =>
        Effect.fail(
          new MusicBrainzRequestFailed({
            operation: 'lookupRecordingByIsrc',
            statusCode: 503,
            cause: 'MusicBrainz unavailable'
          })
        )
    }
    const scraper = makeMusicLinkScraperService(
      [],
      spotify,
      deezer,
      unavailableMusicBrainz,
      unavailableOdesli
    )

    const result = await Effect.runPromise(
      scraper.scrape({
        entityType: 'track',
        url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh',
        isrc: 'GBUM71029604'
      })
    )

    expect(result.links).toEqual([
      {
        platform: 'spotify',
        url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh',
        scrapedAt: expect.any(Date),
        metadata: {
          discoveredBy: 'spotify',
          confidence: 'exact_source',
          externalId: '4iV5W9uYEdYUVa79Axb7Rh'
        }
      }
    ])
    expect(result.entityMeta?.title).toBe('Fallback Track')
  })
})
