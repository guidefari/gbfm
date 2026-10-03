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
  await page.getByRole('textbox', { name: 'Existing audio URL', exact: true }).fill(audioUrl)
  await page.getByRole('textbox', { name: 'Show ID', exact: true }).fill(showId ?? '')
  await page.getByRole('spinbutton', { name: 'Episode number', exact: true }).fill('7')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('textbox', { name: 'Story URL', exact: true }).fill(slug)
  await page.getByRole('textbox', { name: 'Authors', exact: true }).fill(creatorIds.join(', '))
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.locator('.creator-published')).toContainText('Published.')
  await page.goto(`/new/mix?edit=${slug}`)
  await expect(page.getByRole('textbox', { name: 'Existing audio URL', exact: true })).toHaveValue(
    audioUrl,
  )
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tweet', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Edited mix with both creators')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Update', exact: true }).click()
  await expect(page.locator('.creator-published')).toContainText('Published.')
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
  await page.getByRole('button', { name: 'Update', exact: true }).click()
  await expect(page.locator('.creator-published')).toContainText('Published.')
  const response = await page.request.get(`/api/content/posts/${slug}/edit`)
  const post = Schema.decodeUnknownSync(CompiledPostResponse)(await response.json())
  expect(post.content).toBe('The revised editorial body.')
  expect(post.creators?.map(({ id }) => id).sort()).toEqual([...creatorIds].sort())
})

test('artwork upload failures are accessible in the open editorial review and can be retried', async ({
  page,
}, testInfo) => {
  await signIn(page)
  await page.route('**/api/upload/image/presign', (route) =>
    route.fulfill({
      json: {
        uploadUrl: 'https://uploads.example.test/editorial.png',
        publicUrl: 'https://cdn.example.test/editorial.png',
        key: 'editorial.png',
      },
    }),
  )
  let uploads = 0
  await page.route('https://uploads.example.test/editorial.png', (route) => {
    uploads++

    return route.fulfill({ status: uploads === 1 ? 503 : 200 })
  })
  await page.goto('/new/editorial')
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Artwork upload check')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const review = page.getByRole('dialog', { name: 'Publish post', exact: true })
  const artwork = review.getByLabel('Upload artwork', { exact: true })

  const file = {
    name: 'editorial.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=',
      'base64',
    ),
  }

  await artwork.setInputFiles(file)
  await expect(review).toBeVisible()
  await expect(review.getByRole('alert')).toHaveText('artwork upload: Artwork upload failed')
  await expect(artwork).toBeEnabled()

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport)
    await review.getByRole('alert').scrollIntoViewIfNeeded()
    await expect(review.getByRole('alert')).toBeInViewport()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true)
    await testInfo.attach(`artwork-error-${viewport.width}x${viewport.height}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
  }

  await artwork.setInputFiles(file)
  await expect(review.getByRole('textbox', { name: 'Artwork URL', exact: true })).toHaveValue(
    'https://cdn.example.test/editorial.png',
  )
  await expect(review.getByRole('alert')).toHaveCount(0)
  await expect(review).toBeVisible()
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
  await page
    .getByRole('textbox', { name: 'Quote a tweet', exact: true })
    .fill('https://goosebumps.fm/tweet/e2e-music-thread')
  await page.getByRole('button', { name: 'Attach quote', exact: true }).click()
  await expect(page.getByText('Quoted tweet', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('textbox', { name: 'Story URL', exact: true }).fill(slug)
  await page.getByRole('textbox', { name: 'Authors', exact: true }).fill(creatorIds.join(', '))
  const tags = page.getByRole('textbox', { name: 'Tags', exact: true })
  await tags.pressSequentially('radio, community')
  await tags.press('Tab')
  await expect(tags).toHaveValue('radio, community')
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Quote a tweet', exact: true })).toHaveValue(
    'https://goosebumps.fm/tweet/e2e-music-thread',
  )
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Authors', exact: true })).toHaveValue(
    creatorIds.join(', '),
  )
  await expect(page.getByRole('textbox', { name: 'Tags', exact: true })).toHaveValue(
    'radio, community',
  )
  await expect(page.locator('.creator-review-copy')).toContainText('independent radio')
  await page.getByRole('button', { name: 'Editorial', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Editorial', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Tweet', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tweet', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
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
  await expect(page.locator('.creator-published')).toContainText('Published.')

  const saved = Schema.decodeUnknownSync(CompiledPostResponse)(
    await (await page.request.get(`/api/content/posts/${slug}/edit`)).json(),
  )

  expect(saved.quotedPostId).toBe(quoted.id)
  expect(saved.tags).toEqual(['radio', 'community'])
  expect(saved.creators?.map(({ id }) => id).sort()).toEqual([...creatorIds].sort())
  await page.goto(`/new/tweet?edit=${slug}`)
  await expect(page.getByRole('textbox', { name: 'Quote a tweet', exact: true })).toHaveCount(0)
})
