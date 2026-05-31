import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { Pool } from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const vpsRoot = path.resolve(__dirname, '../..')

let container: StartedPostgreSqlContainer

const entityTypes = [
  { id: 'artist', displayName: 'Artist' },
  { id: 'album', displayName: 'Album' },
  { id: 'track', displayName: 'Track' },
  { id: 'playlist', displayName: 'Playlist' }
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
  { id: 'other', displayName: 'Other' }
]

export async function setup() {
  console.log('\n[test] Starting PostgreSQL container...')

  container = await new PostgreSqlContainer('postgres:16-alpine').start()

  const host = container.getHost()
  const port = String(container.getMappedPort(5432))
  const user = container.getUsername()
  const password = container.getPassword()
  const database = container.getDatabase()
  const dbUrl = container.getConnectionUri()

  process.env.DB_HOST = host
  process.env.DB_PORT = port
  process.env.DB_USER = user
  process.env.DB_PASSWORD = password
  process.env.DB_NAME = database

  process.env.SST_RESOURCES_JSON = JSON.stringify({
    App: { stage: 'test' },
    Email: { sender: 'test@test.com' },
    BETTER_AUTH_SECRET: { value: 'test-secret' },
    BETTER_AUTH_URL: { value: 'http://localhost:3000' },
    Urls: { site: 'http://127.0.0.1:5173' },
    SpotifyClientId: { value: 'test-client-id' },
    SpotifyClientSecret: { value: 'test-client-secret' }
  })

  console.log('[test] Pushing schema with drizzle-kit...')
  execSync('bunx drizzle-kit push --force', {
    cwd: vpsRoot,
    env: {
      ...process.env,
      DB_HOST: host,
      DB_PORT: port,
      DB_USER: user,
      DB_PASSWORD: password,
      DB_NAME: database
    },
    stdio: 'pipe'
  })

  console.log('[test] Seeding lookup tables...')
  const pool = new Pool({ connectionString: dbUrl })

  await pool.query(
    `INSERT INTO music_entity_types (id, "displayName") VALUES ${entityTypes.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')} ON CONFLICT (id) DO NOTHING`,
    entityTypes.flatMap((e) => [e.id, e.displayName])
  )
  await pool.query(
    `INSERT INTO music_platforms (id, "displayName", "websiteUrl") VALUES ${platforms.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ')} ON CONFLICT (id) DO NOTHING`,
    platforms.flatMap((p) => [p.id, p.displayName, p.websiteUrl ?? null])
  )

  await pool.end()

  console.log('[test] PostgreSQL ready at', dbUrl)
}

export async function teardown() {
  console.log('[test] Stopping PostgreSQL container...')
  await container?.stop()
}
