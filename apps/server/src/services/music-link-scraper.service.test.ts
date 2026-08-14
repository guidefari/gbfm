import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  type MusicDataProvider,
  MusicScraperError,
  makeMusicLinkScraperService
} from './music-link-scraper.service'
import type { SpotifyService } from './spotify.service'

const unavailableOdesli: MusicDataProvider = {
  name: 'odesli',
  fetchLinks: () =>
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
  searchTrackByIsrc: () => Effect.die('unexpected searchTrackByIsrc call'),
  searchAlbumByTitleArtist: () => Effect.die('unexpected searchAlbumByTitleArtist call'),
  enrichTrackFromUrl: () => Effect.die('unexpected enrichTrackFromUrl call')
}

describe('makeMusicLinkScraperService', () => {
  test('falls back to Spotify track metadata when Odesli is unavailable', async () => {
    const scraper = makeMusicLinkScraperService([unavailableOdesli], spotify)

    const result = await Effect.runPromise(
      scraper.scrape({ url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh' })
    )

    expect(result).toEqual({
      links: [
        {
          platform: 'spotify',
          url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh',
          scrapedAt: expect.any(Date)
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
})
