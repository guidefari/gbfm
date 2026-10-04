import { AudioPageResponse, CompiledAudioResponse } from '@gbfm/api/audio'
import { SiteMetadata } from '@gbfm/site-metadata'
import { eq } from 'drizzle-orm'
import { Schema } from 'effect'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { audioCreators, audioTable } from '@/db/audio.schema'
import { session, user } from '@/db/auth.schema'
import { favoritesTable } from '@/db/favorites.schema'
import { showsTable } from '@/db/show.schema'
import { db, d1 } from '@/test/database'
import { createTestWebHandler } from '@/test/http-handler'

const creatorId = 'audio-page-creator'

const listenerId = 'audio-page-listener'

const otherId = 'audio-page-other'

const adminId = 'audio-page-admin'

const publicSlug = 'audio-page-public'

const draftSlug = 'audio-page-draft'

let webHandler: ReturnType<typeof createTestWebHandler>

const requestPage = async (slug = publicSlug, token?: string, type = 'mix') => {
  const response = await webHandler.handler(
    new Request(`http://localhost/api/content/audio/${type}/${slug}/page`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )

  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')

  return Schema.decodeUnknownSync(AudioPageResponse)(await response.json())
}

beforeAll(async () => {
  webHandler = createTestWebHandler(d1)
  await db.insert(user).values([
    { id: creatorId, name: 'Creator', email: 'audio-page-creator@example.com', role: 'creator' },
    { id: listenerId, name: 'Listener', email: 'audio-page-listener@example.com' },
    { id: otherId, name: 'Other', email: 'audio-page-other@example.com' },
    { id: adminId, name: 'Admin', email: 'audio-page-admin@example.com', role: 'admin' },
  ])
  await db.insert(session).values(
    [creatorId, listenerId, otherId, adminId].map((id) => ({
      id: `session-${id}`,
      token: `token-${id}`,
      userId: id,
      expiresAt: new Date(Date.now() + 86_400_000),
      updatedAt: new Date(),
    })),
  )
  await db.insert(showsTable).values({
    id: 'audio-page-show',
    slug: 'audio-page-show',
    title: 'Fixture show',
    content: '',
    thumbnailUrl: 'https://example.com/show.webp',
  })
  await db.insert(audioTable).values([
    {
      id: publicSlug,
      slug: publicSlug,
      title: 'Public audio fixture',
      description: 'Fixture description',
      content: '# Listening document\n\nFixture paragraph.',
      type: 'mix',
      url: 'https://example.com/audio.mp3',
      showId: 'audio-page-show',
    },
    {
      id: draftSlug,
      slug: draftSlug,
      title: 'Private draft fixture',
      content: 'Private draft content',
      draft: true,
      type: 'mix',
      url: 'https://example.com/draft.mp3',
    },
    {
      id: 'audio-page-track',
      slug: 'audio-page-track',
      title: 'Track fixture',
      content: '',
      type: 'track',
      url: 'https://example.com/track.mp3',
    },
  ])
  await db.insert(audioCreators).values([
    { audioId: publicSlug, creatorId },
    { audioId: draftSlug, creatorId },
  ])
  await db.insert(favoritesTable).values([
    { userId: listenerId, audioId: publicSlug },
    { userId: creatorId, audioId: draftSlug },
  ])
})

afterAll(async () => webHandler.dispose())

describe('Audio detail page HTTP read', () => {
  test('anonymous readers receive content and public metadata without identity or favorite state', async () => {
    const page = await requestPage()
    expect(page._tag).toBe('Ready')

    if (!AudioPageResponse.guards.Ready(page)) throw new Error('Expected ready page')
    expect(page.principal).toBeNull()
    expect(page.favorite).toBe('anonymous')
    expect(page.audio.thumbnailUrl).toBe('https://example.com/show.webp')
    expect(page.audio.richContent).toBeDefined()
    expect(page.audio.creators?.map((creator) => creator.id)).toEqual([creatorId])
    expect(page.metadata?.kind).toBe('mix')
  })

  test('the page audio and metadata match the existing resource endpoints', async () => {
    const page = await requestPage()

    if (!AudioPageResponse.guards.Ready(page)) throw new Error('Expected ready page')

    const audio = await webHandler.handler(
      new Request(`http://localhost/api/content/audio/mix/${publicSlug}`),
    )

    const metadata = await webHandler.handler(
      new Request(`http://localhost/api/site-metadata/mix/${publicSlug}`),
    )

    expect(page.audio).toEqual(Schema.decodeUnknownSync(CompiledAudioResponse)(await audio.json()))
    expect(page.metadata).toEqual(Schema.decodeUnknownSync(SiteMetadata)(await metadata.json()))
  })

  test('a signed-in listener receives only their own favorite membership', async () => {
    const favored = await requestPage(publicSlug, `token-${listenerId}`)
    const other = await requestPage(publicSlug, `token-${otherId}`)
    expect(favored._tag).toBe('Ready')
    expect(other._tag).toBe('Ready')

    if (!AudioPageResponse.guards.Ready(favored) || !AudioPageResponse.guards.Ready(other))
      throw new Error('Expected ready pages')
    expect(favored.principal?.id).toBe(listenerId)
    expect(favored.favorite).toBe('active')
    expect(other.principal?.id).toBe(otherId)
    expect(other.favorite).toBe('inactive')
  })

  test('anonymous and unrelated users cannot see another creator draft', async () => {
    for (const token of [undefined, `token-${otherId}`, `token-${listenerId}`]) {
      const page = await requestPage(draftSlug, token)
      expect(page._tag).toBe('NotFound')
      expect(JSON.stringify(page)).not.toContain('Private draft')
    }
  })

  test('creators and admins can see a draft without public metadata or an active draft favorite', async () => {
    for (const id of [creatorId, adminId]) {
      const page = await requestPage(draftSlug, `token-${id}`)

      if (!AudioPageResponse.guards.Ready(page)) throw new Error('Expected ready page')
      expect(page.audio.draft).toBe(true)
      expect(page.metadata).toBeNull()
      expect(page.favorite).toBe('inactive')
    }
  })

  test('invalid and expired tokens are treated as anonymous, without draft access', async () => {
    await db.insert(session).values({
      id: 'audio-page-expired-session',
      token: 'audio-page-expired-token',
      userId: creatorId,
      expiresAt: new Date(Date.now() - 86_400_000),
      updatedAt: new Date(),
    })

    for (const token of ['invalid-session', 'audio-page-expired-token']) {
      const page = await requestPage(draftSlug, token)
      expect(page._tag).toBe('NotFound')
      expect(page.principal).toBeNull()
    }
  })

  test('browser-supplied identity headers do not grant draft access', async () => {
    const response = await webHandler.handler(
      new Request(`http://localhost/api/content/audio/mix/${draftSlug}/page`, {
        headers: { 'x-user-id': adminId, 'x-user-role': 'admin' },
      }),
    )

    const page = Schema.decodeUnknownSync(AudioPageResponse)(await response.json())
    expect(page._tag).toBe('NotFound')
    expect(page.principal).toBeNull()
  })

  test('a revoked session loses draft access on the next request', async () => {
    const token = 'audio-page-revoked-token'
    await db.insert(session).values({
      id: 'audio-page-revoked-session',
      token,
      userId: creatorId,
      expiresAt: new Date(Date.now() + 86_400_000),
      updatedAt: new Date(),
    })
    expect((await requestPage(draftSlug, token))._tag).toBe('Ready')
    await db.delete(session).where(eq(session.token, token))
    const page = await requestPage(draftSlug, token)
    expect(page._tag).toBe('NotFound')
    expect(page.principal).toBeNull()
  })

  test('missing audio and wrong audio types remain not found', async () => {
    expect((await requestPage('audio-page-missing'))._tag).toBe('NotFound')
    expect((await requestPage(publicSlug, undefined, 'track'))._tag).toBe('NotFound')
  })

  test('track detail uses the same page read and produces track metadata', async () => {
    const page = await requestPage('audio-page-track', undefined, 'track')

    if (!AudioPageResponse.guards.Ready(page)) throw new Error('Expected ready page')
    expect(page.audio.type).toBe('track')
    expect(page.metadata?.kind).toBe('track')
  })

  test('session refresh cookies are forwarded by the page read', async () => {
    const signup = await webHandler.handler(
      new Request('http://localhost/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Session refresh fixture',
          email: 'audio-page-refresh@example.com',
          password: 'fixture-password-only-123',
        }),
      }),
    )

    expect(signup.status).toBe(200)

    const cookies = signup.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0])
      .join('; ')

    expect(cookies).toContain('session_token=')

    const [listener] = await db
      .select()
      .from(user)
      .where(eq(user.email, 'audio-page-refresh@example.com'))

    if (!listener) throw new Error('Expected fixture user')
    await db
      .update(session)
      .set({
        expiresAt: new Date(Date.now() + 5 * 86_400_000),
        updatedAt: new Date(Date.now() - 2 * 86_400_000),
      })
      .where(eq(session.userId, listener.id))

    const response = await webHandler.handler(
      new Request(`http://localhost/api/content/audio/mix/${publicSlug}/page`, {
        headers: { cookie: cookies },
      }),
    )

    const page = Schema.decodeUnknownSync(AudioPageResponse)(await response.json())
    expect(page.principal?.id).toBe(listener.id)
    expect(
      response.headers.getSetCookie().some((cookie) => cookie.includes('session_token=')),
    ).toBe(true)
    const [refreshed] = await db.select().from(session).where(eq(session.userId, listener.id))
    expect(refreshed?.updatedAt.getTime()).toBeGreaterThan(Date.now() - 60_000)
  })
})
