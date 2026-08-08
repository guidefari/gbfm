import { randomUUID } from 'node:crypto'
import { Effect, Layer } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { DatabaseTestLayer, db } from '@/test/database'
import { audioCreators, audioTable } from '@/db/audio.schema'
import { user } from '@/db/auth.schema'
import { showCreators, showsTable } from '@/db/show.schema'
import { ProfileService, ProfileServiceLayer } from './profile.service'

const username = `profile-${randomUUID().slice(0, 8)}`
const ownerId = `profile-owner-${randomUUID()}`
const otherId = `profile-other-${randomUUID()}`

const getService = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* ProfileService
    }).pipe(Effect.provide(ProfileServiceLayer.pipe(Layer.provide(DatabaseTestLayer))))
  )

const insertAudio = async (values: {
  slug: string
  creatorId: string
  showId?: string
  thumbnailUrl?: string
  draft?: boolean
}) => {
  const [audio] = await db
    .insert(audioTable)
    .values({
      title: `Audio ${values.slug}`,
      slug: values.slug,
      content: '',
      type: 'mix',
      url: 'https://example.com/audio.mp3',
      showId: values.showId ?? null,
      thumbnailUrl: values.thumbnailUrl ?? null,
      draft: values.draft ?? false
    })
    .returning()

  if (!audio) {
    throw new Error('Failed to insert audio fixture')
  }

  await db.insert(audioCreators).values({ audioId: audio.id, creatorId: values.creatorId })
  return audio
}

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: ownerId,
      name: 'Profile owner',
      email: `${ownerId}@example.com`,
      username
    },
    {
      id: otherId,
      name: 'Profile other',
      email: `${otherId}@example.com`,
      username: `${username}-other`
    }
  ])
})

describe('getPublicProfile mixes', () => {
  test('returns only mixes the profile user created', async () => {
    const service = await getService()

    const own = await insertAudio({ slug: `own-${randomUUID()}`, creatorId: ownerId })
    const other = await insertAudio({ slug: `other-${randomUUID()}`, creatorId: otherId })

    const profile = await Effect.runPromise(service.getPublicProfile(username))
    const ids = profile.content.mixes.map((mix) => mix.id)

    expect(ids).toContain(own.id)
    expect(ids).not.toContain(other.id)
  })

  test('excludes draft mixes', async () => {
    const service = await getService()

    const draft = await insertAudio({
      slug: `draft-${randomUUID()}`,
      creatorId: ownerId,
      draft: true
    })

    const profile = await Effect.runPromise(service.getPublicProfile(username))

    expect(profile.content.mixes.map((mix) => mix.id)).not.toContain(draft.id)
  })

  test('falls back to the show thumbnailUrl when a mix has none', async () => {
    const service = await getService()
    const showSlug = `profile-show-${randomUUID()}`

    const [show] = await db
      .insert(showsTable)
      .values({
        title: `Show ${showSlug}`,
        slug: showSlug,
        content: '',
        thumbnailUrl: 'https://example.com/show-art.png'
      })
      .returning()

    if (!show) {
      throw new Error('Failed to insert show fixture')
    }

    await db.insert(showCreators).values({ showId: show.id, creatorId: ownerId })

    const episode = await insertAudio({
      slug: `episode-${randomUUID()}`,
      creatorId: ownerId,
      showId: show.id
    })
    const standalone = await insertAudio({
      slug: `standalone-${randomUUID()}`,
      creatorId: ownerId,
      thumbnailUrl: 'https://example.com/own-art.png'
    })

    const profile = await Effect.runPromise(service.getPublicProfile(username))
    const mixes = profile.content.mixes

    expect(mixes.find((mix) => mix.id === episode.id)?.thumbnailUrl).toBe(
      'https://example.com/show-art.png'
    )
    expect(mixes.find((mix) => mix.id === standalone.id)?.thumbnailUrl).toBe(
      'https://example.com/own-art.png'
    )
  })
})
