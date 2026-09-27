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
  return { creatorIds, audioUrl: mix.url, showId: mix.showId }
}

test('mix creation satisfies the API contract and editing preserves audio and co-creators', async ({
  page,
}) => {
  const { creatorIds, audioUrl, showId } = await signIn(page)
  const slug = `e2e-composer-mix-${Date.now()}`
  await page.goto('/new/mix')
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('A newly published mix')
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug)
  await page.getByRole('textbox', { name: 'Existing audio URL', exact: true }).fill(audioUrl)
  await page
    .getByRole('textbox', { name: 'Creator IDs (comma separated)', exact: true })
    .fill(creatorIds.join(', '))
  await page.getByRole('textbox', { name: 'Show ID', exact: true }).fill(showId ?? '')
  await page.getByRole('spinbutton', { name: 'Episode number', exact: true }).fill('7')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Published.')
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
  expect(mix.showId).toBe(showId)
  expect(mix.episodeNumber).toBe(7)
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

test('composer restores metadata, reviews type changes and publishes a quoted tweet with co-creators', async ({
  page,
}, testInfo) => {
  const { creatorIds } = await signIn(page)
  const quoted = Schema.decodeUnknownSync(CompiledPostResponse)(
    await (await page.request.get('/api/content/posts/e2e-music-thread')).json(),
  )
  const slug = `e2e-quote-${Date.now()}`
  await page.goto('/new/tweet')
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('A quoted signal')
  await page
    .getByRole('textbox', { name: 'Writing canvas', exact: true })
    .fill('Listening to **independent radio**.')
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug)
  await page
    .getByRole('textbox', { name: 'Creator IDs (comma separated)', exact: true })
    .fill(creatorIds.join(', '))
  await page.getByRole('textbox', { name: 'Quoted post ID', exact: true }).fill(quoted.id)
  const tags = page.getByRole('textbox', { name: 'Tags', exact: true })
  await tags.pressSequentially('radio, community')
  await tags.press('Tab')
  await expect(tags).toHaveValue('radio, community')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Quoted post ID', exact: true })).toHaveValue(
    quoted.id,
  )
  await expect(
    page.getByRole('textbox', { name: 'Creator IDs (comma separated)', exact: true }),
  ).toHaveValue(creatorIds.join(', '))
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.locator('.creator-review strong')).toHaveText('independent radio')
  await page.getByRole('combobox', { name: 'Publish as' }).selectOption('post')
  await expect(page.locator('.creator-review')).toContainText('Type: post')
  await page.getByRole('combobox', { name: 'Publish as' }).selectOption('micro')
  await expect(page.locator('.creator-review')).toContainText('Type: micro')
  await page.getByRole('button', { name: 'Publish', exact: true }).scrollIntoViewIfNeeded()
  await testInfo.attach('composer-review-dark', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await page.emulateMedia({ colorScheme: 'light' })
  await testInfo.attach('composer-review-light', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Published.')
  const saved = Schema.decodeUnknownSync(CompiledPostResponse)(
    await (await page.request.get(`/api/content/posts/${slug}/edit`)).json(),
  )
  expect(saved.quotedPostId).toBe(quoted.id)
  expect(saved.tags).toEqual(['radio', 'community'])
  expect(saved.creators?.map(({ id }) => id).sort()).toEqual([...creatorIds].sort())
  await page.goto(`/new/tweet?edit=${slug}`)
  await expect(page.getByRole('textbox', { name: 'Quoted post ID', exact: true })).toBeDisabled()
})
