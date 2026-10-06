import { GetShowEpisodesResponse, ShowPageResponse } from '@gbfm/api/shows'
import { SiteMetadata } from '@gbfm/site-metadata'
import { eq } from 'drizzle-orm'
import { Schema } from 'effect'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { audioTable } from '@/db/audio.schema'
import { session, user } from '@/db/auth.schema'
import { showCreators, showsTable, showSubscriptionsTable } from '@/db/show.schema'
import { db, d1 } from '@/test/database'
import { createTestWebHandler } from '@/test/http-handler'

const slug = 'show-page-public'

const draftSlug = 'show-page-draft'

const listenerId = 'show-page-listener'

const adminId = 'show-page-admin'

const hostId = 'show-page-host'

let webHandler: ReturnType<typeof createTestWebHandler>

const requestPage = async (showSlug = slug, token?: string) => {
  const response = await webHandler.handler(
    new Request(`http://localhost/api/shows/${showSlug}/page`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )

  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')

  return Schema.decodeUnknownSync(ShowPageResponse)(await response.json())
}

beforeAll(async () => {
  webHandler = createTestWebHandler(d1)
  await db.insert(user).values([
    { id: listenerId, name: 'Listener', email: 'show-page-listener@example.com' },
    { id: hostId, name: 'Host', email: 'show-page-host@example.com', role: 'creator' },
    { id: adminId, name: 'Admin', email: 'show-page-admin@example.com', role: 'admin' },
  ])
  await db.insert(session).values(
    [listenerId, hostId, adminId].map((id) => ({
      id: `session-${id}`,
      token: `token-${id}`,
      userId: id,
      expiresAt: new Date(Date.now() + 86_400_000),
      updatedAt: new Date(),
    })),
  )
  await db.insert(showsTable).values([
    {
      id: slug,
      slug,
      title: 'Public show fixture',
      description: 'Fixture description',
      content: '# Fixture',
      thumbnailUrl: 'https://example.com/show.webp',
    },
    {
      id: draftSlug,
      slug: draftSlug,
      title: 'Private show fixture',
      content: 'Private content',
      draft: true,
    },
    { id: 'show-page-empty', slug: 'show-page-empty', title: 'Empty show', content: '' },
  ])
  await db.insert(showCreators).values([
    { showId: slug, creatorId: hostId },
    { showId: draftSlug, creatorId: hostId },
  ])
  await db.insert(audioTable).values([
    {
      id: 'show-page-episode',
      slug: 'show-page-episode',
      title: 'Published episode',
      content: '',
      type: 'mix',
      url: 'https://example.com/audio.mp3',
      showId: slug,
    },
    {
      id: 'show-page-draft-episode',
      slug: 'show-page-draft-episode',
      title: 'Private episode',
      content: '',
      type: 'mix',
      url: 'https://example.com/draft.mp3',
      showId: slug,
      draft: true,
    },
    {
      id: 'show-page-unrelated-episode',
      slug: 'show-page-unrelated-episode',
      title: 'Unrelated episode',
      content: '',
      type: 'mix',
      url: 'https://example.com/other.mp3',
      showId: 'show-page-empty',
    },
  ])
  await db.insert(showSubscriptionsTable).values({ userId: listenerId, showId: slug })
})

afterAll(async () => webHandler.dispose())

describe('Show detail page HTTP read', () => {
  test('anonymous content, metadata and episodes match the existing published endpoints', async () => {
    const page = await requestPage()

    if (!ShowPageResponse.guards.Ready(page)) throw new Error('Expected ready page')
    expect(page.principal).toBeNull()
    expect(page.subscription).toBe('anonymous')
    expect(page.show.hosts?.map((host) => host.id)).toEqual([hostId])
    expect(page.show.richContent).toBeDefined()
    expect(page.shows.some((show) => show.slug === draftSlug)).toBe(false)
    expect(page.episodes?.data.map((episode) => episode.id)).toEqual(['show-page-episode'])
    expect(page.episodes?.data[0]?.thumbnailUrl).toBe('https://example.com/show.webp')

    const episodes = await webHandler.handler(
      new Request(`http://localhost/api/shows/${slug}/episodes?limit=100&offset=0`),
    )

    const metadata = await webHandler.handler(
      new Request(`http://localhost/api/site-metadata/show/${slug}`),
    )

    const show = await webHandler.handler(new Request(`http://localhost/api/shows/${slug}`))
    expect(page.episodes).toEqual(
      Schema.decodeUnknownSync(GetShowEpisodesResponse)(await episodes.json()),
    )
    expect(page.metadata).toEqual(Schema.decodeUnknownSync(SiteMetadata)(await metadata.json()))
    expect(page.show).toEqual(await show.json())
  })

  test('subscription state is scoped to the resolved listener', async () => {
    const listener = await requestPage(slug, `token-${listenerId}`)
    const other = await requestPage(slug, `token-${hostId}`)

    if (!ShowPageResponse.guards.Ready(listener) || !ShowPageResponse.guards.Ready(other))
      throw new Error('Expected ready pages')
    expect(listener.principal?.id).toBe(listenerId)
    expect(listener.subscription).toBe('active')
    expect(other.subscription).toBe('inactive')
  })

  test('draft shows remain hidden even from hosts and admins on the public page', async () => {
    for (const token of [undefined, `token-${listenerId}`, `token-${hostId}`, `token-${adminId}`]) {
      const page = await requestPage(draftSlug, token)
      expect(page._tag).toBe('NotFound')
      expect(JSON.stringify(page)).not.toContain('Private content')
    }
  })

  test('only admins receive draft episodes and no unrelated episodes are included', async () => {
    for (const id of [listenerId, hostId, adminId]) {
      const page = await requestPage(slug, `token-${id}`)

      if (!ShowPageResponse.guards.Ready(page)) throw new Error('Expected ready page')
      const ids = page.episodes?.data.map((episode) => episode.id)
      expect(ids).not.toContain('show-page-unrelated-episode')
      expect(ids?.includes('show-page-draft-episode')).toBe(id === adminId)
    }
  })

  test('missing shows and empty episode lists retain distinct outcomes', async () => {
    expect((await requestPage('missing-show-page'))._tag).toBe('NotFound')
    await db.delete(audioTable).where(eq(audioTable.id, 'show-page-unrelated-episode'))
    const empty = await requestPage('show-page-empty')

    if (!ShowPageResponse.guards.Ready(empty)) throw new Error('Expected ready page')
    expect(empty.episodes?.data).toEqual([])
    expect(empty.episodes?.pagination).toEqual({ total: 0, limit: 100, offset: 0, hasMore: false })
  })

  test('expired, invalid and revoked sessions lose admin episode access', async () => {
    const token = 'show-page-revoked'
    await db.insert(session).values({
      id: token,
      token,
      userId: adminId,
      expiresAt: new Date(Date.now() + 86_400_000),
      updatedAt: new Date(),
    })
    const authenticated = await requestPage(slug, token)
    expect(authenticated.principal?.id).toBe(adminId)
    await db.delete(session).where(eq(session.token, token))
    await db.insert(session).values({
      id: 'show-page-expired',
      token: 'show-page-expired',
      userId: adminId,
      expiresAt: new Date(Date.now() - 86_400_000),
      updatedAt: new Date(),
    })

    for (const credential of [token, 'invalid-token', 'show-page-expired']) {
      const page = await requestPage(slug, credential)

      if (!ShowPageResponse.guards.Ready(page)) throw new Error('Expected ready page')
      expect(page.principal).toBeNull()
      expect(page.subscription).toBe('anonymous')
      expect(page.episodes?.data.some((episode) => episode.draft)).toBe(false)
    }
  })

  test('untrusted identity headers do not grant admin access and responses exclude private identity fields', async () => {
    const response = await webHandler.handler(
      new Request(`http://localhost/api/shows/${slug}/page`, {
        headers: { 'x-user-id': adminId, 'x-user-role': 'admin' },
      }),
    )

    const page = Schema.decodeUnknownSync(ShowPageResponse)(await response.json())
    expect(page.principal).toBeNull()
    const signedIn = await requestPage(slug, `token-${listenerId}`)
    expect(JSON.stringify(signedIn)).not.toContain(`token-${listenerId}`)
    expect(JSON.stringify(signedIn)).not.toContain('show-page-listener@example.com')
  })

  test('session renewal cookies are forwarded through the page endpoint', async () => {
    const signup = await webHandler.handler(
      new Request('http://localhost/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Show refresh fixture',
          email: 'show-page-refresh@example.com',
          password: 'fixture-password-only-123',
        }),
      }),
    )

    expect(signup.status).toBe(200)

    const cookie = signup.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ')

    const [listener] = await db
      .select()
      .from(user)
      .where(eq(user.email, 'show-page-refresh@example.com'))

    if (!listener) throw new Error('Expected fixture listener')
    await db
      .update(session)
      .set({
        expiresAt: new Date(Date.now() + 5 * 86_400_000),
        updatedAt: new Date(Date.now() - 2 * 86_400_000),
      })
      .where(eq(session.userId, listener.id))

    const response = await webHandler.handler(
      new Request(`http://localhost/api/shows/${slug}/page`, { headers: { cookie } }),
    )

    expect(response.headers.getSetCookie().some((value) => value.includes('session_token='))).toBe(
      true,
    )
    const page = Schema.decodeUnknownSync(ShowPageResponse)(await response.json())
    expect(page.principal?.id).toBe(listener.id)
  })
})
