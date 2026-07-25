import { db } from '@/db'
import { musicEntityTypesTable, musicPlatformsTable } from '@/db/music-entity.schema'

const entityTypes = [
  { id: 'artist', displayName: 'Artist' },
  { id: 'album', displayName: 'Album' },
  { id: 'track', displayName: 'Track' },
  { id: 'playlist', displayName: 'Playlist' },
  { id: 'label', displayName: 'Label' }
]

const platforms = [
  { id: 'spotify', displayName: 'Spotify', websiteUrl: 'https://spotify.com' },
  { id: 'youtube', displayName: 'YouTube', websiteUrl: 'https://youtube.com' },
  {
    id: 'youtube_music',
    displayName: 'YouTube Music',
    websiteUrl: 'https://music.youtube.com'
  },
  {
    id: 'apple_music',
    displayName: 'Apple Music',
    websiteUrl: 'https://music.apple.com'
  },
  {
    id: 'bandcamp',
    displayName: 'Bandcamp',
    websiteUrl: 'https://bandcamp.com'
  },
  {
    id: 'soundcloud',
    displayName: 'SoundCloud',
    websiteUrl: 'https://soundcloud.com'
  },
  { id: 'tidal', displayName: 'Tidal', websiteUrl: 'https://tidal.com' },
  { id: 'deezer', displayName: 'Deezer', websiteUrl: 'https://deezer.com' },
  {
    id: 'amazon_music',
    displayName: 'Amazon Music',
    websiteUrl: 'https://music.amazon.com'
  },
  { id: 'discord', displayName: 'Discord', websiteUrl: 'https://discord.com' },
  { id: 'website', displayName: 'Official Website' },
  {
    id: 'instagram',
    displayName: 'Instagram',
    websiteUrl: 'https://instagram.com'
  },
  { id: 'twitter', displayName: 'Twitter / X', websiteUrl: 'https://x.com' },
  {
    id: 'musicbrainz',
    displayName: 'MusicBrainz',
    websiteUrl: 'https://musicbrainz.org'
  },
  { id: 'discogs', displayName: 'Discogs', websiteUrl: 'https://discogs.com' },
  { id: 'other', displayName: 'Other' }
]

export async function seedMusicLookups() {
  await db
    .insert(musicEntityTypesTable)
    .values(entityTypes)
    .onConflictDoUpdate({
      target: musicEntityTypesTable.id,
      set: { displayName: musicEntityTypesTable.displayName }
    })

  await db
    .insert(musicPlatformsTable)
    .values(platforms)
    .onConflictDoUpdate({
      target: musicPlatformsTable.id,
      set: {
        displayName: musicPlatformsTable.displayName,
        websiteUrl: musicPlatformsTable.websiteUrl,
        iconUrl: musicPlatformsTable.iconUrl
      }
    })

  return {
    entityTypeCount: entityTypes.length,
    platformCount: platforms.length
  }
}
