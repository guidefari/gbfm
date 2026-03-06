/**
 * Seed script: populate music_entity_types and music_platforms lookup tables.
 *
 * Run once after applying the music-metadata migration:
 *   bun scripts/seed-music-lookups.ts
 *
 * Safe to re-run — uses INSERT … ON CONFLICT DO UPDATE so values are kept
 * in sync with the TypeScript constants without duplicating rows.
 */

import { db } from '../src/db'
import {
  musicEntityTypesTable,
  musicPlatformsTable
} from '../src/db/music-entity.schema'

const ENTITY_TYPES: Array<{
  id: string
  displayName: string
}> = [
  { id: 'artist', displayName: 'Artist' },
  { id: 'album', displayName: 'Album' },
  { id: 'track', displayName: 'Track' },
  { id: 'playlist', displayName: 'Playlist' }
]

const PLATFORMS: Array<{
  id: string
  displayName: string
  websiteUrl?: string
}> = [
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
  { id: 'bandcamp', displayName: 'Bandcamp', websiteUrl: 'https://bandcamp.com' },
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
  { id: 'other', displayName: 'Other' }
]

async function seed() {
  console.log('Seeding music_entity_types…')
  await db
    .insert(musicEntityTypesTable)
    .values(ENTITY_TYPES)
    .onConflictDoUpdate({
      target: musicEntityTypesTable.id,
      set: { displayName: musicEntityTypesTable.displayName }
    })
  console.log(`  ✓ ${ENTITY_TYPES.length} entity types`)

  console.log('Seeding music_platforms…')
  await db
    .insert(musicPlatformsTable)
    .values(PLATFORMS)
    .onConflictDoUpdate({
      target: musicPlatformsTable.id,
      set: {
        displayName: musicPlatformsTable.displayName,
        websiteUrl: musicPlatformsTable.websiteUrl
      }
    })
  console.log(`  ✓ ${PLATFORMS.length} platforms`)

  console.log('\nDone.')
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
