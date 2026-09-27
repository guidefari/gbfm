import { AudioResponse } from '@gbfm/api/audio'
import { CompiledPostResponse } from '@gbfm/api/post'
import { expect, test, type Page } from '@playwright/test'
import { Schema } from 'effect'

const signIn = async (page: Page) => {
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('admin@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const session = await page.request.get('/auth/get-session')
  const identity = Schema.decodeUnknownSync(
    Schema.Struct({ user: Schema.Struct({ id: Schema.String }) }),
  )(await session.json())
  const fixture = await page.request.get('/api/content/audio/mix/e2e-local-frequencies')
  const mix = Schema.decodeUnknownSync(AudioResponse)(await fixture.json())
  const creatorIds = [identity.user.id, ...(mix.creators ?? []).map(({ id }) => id)]
  expect(creatorIds).toHaveLength(2)
  return { creatorIds, audioUrl: mix.url }
}

test('mix creation satisfies the API contract and editing preserves audio and co-creators', async ({
  page,
}) => {
  const { creatorIds, audioUrl } = await signIn(page)
  const slug = `e2e-composer-mix-${Date.now()}`
  await page.goto('/new/mix')
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('A newly published mix')
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug)
  await page.getByRole('textbox', { name: 'Existing audio URL', exact: true }).fill(audioUrl)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Published.')
  const authors = await page.request.patch(`/api/content/audio/mix/${slug}`, {
    data: { creatorIds },
  })
  expect(authors.ok()).toBe(true)
  await page.goto(`/new/mix?edit=${slug}`)
  await expect(page.getByRole('textbox', { name: 'Existing audio URL', exact: true })).toHaveValue(
    audioUrl,
  )
  await expect(page.getByRole('combobox', { name: 'Publish as' })).toBeDisabled()
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Edited mix with both creators')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Published.')
  const response = await page.request.get(`/api/content/audio/mix/${slug}`)
  const mix = Schema.decodeUnknownSync(AudioResponse)(await response.json())
  expect(mix.title).toBe('Edited mix with both creators')
  expect(mix.url).toBe(audioUrl)
  expect(mix.creators?.map(({ id }) => id).sort()).toEqual([...creatorIds].sort())
})

test('editorial editing with empty artwork preserves co-creators and saved content', async ({
  page,
}) => {
  const { creatorIds } = await signIn(page)
  const slug = `e2e-composer-editorial-${Date.now()}`
  const created = await page.request.post('/api/content/post', {
    data: {
      type: 'post',
      slug,
      title: 'Original editorial',
      content: 'Original body',
      draft: false,
      creatorIds,
    },
  })
  expect(created.ok()).toBe(true)
  await page.goto(`/new/editorial?edit=${slug}`)
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
    'Original editorial',
  )
  await page.getByRole('textbox', { name: 'Writing canvas' }).fill('The revised editorial body.')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Published.')
  const response = await page.request.get(`/api/content/posts/${slug}/edit`)
  const post = Schema.decodeUnknownSync(CompiledPostResponse)(await response.json())
  expect(post.content).toBe('The revised editorial body.')
  expect(post.creators?.map(({ id }) => id).sort()).toEqual([...creatorIds].sort())
})
