import { AlbumResponse, EntityLinkListResponse, LabelListResponse } from '@gbfm/api/music'
import { expect, test } from '@playwright/test'
import { Schema } from 'effect'

test('catalog tabs, label creation and album metadata/link management persist in D1', async ({
  page,
}, testInfo) => {
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('admin@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const slug = `catalog-check-${Date.now()}`
  await page.goto('/dashboard/music?tab=labels')
  await page.getByRole('textbox', { name: 'Label name', exact: true }).fill('A fixture label')
  await page.getByRole('textbox', { name: 'Label slug', exact: true }).fill(slug)
  await page.getByRole('button', { name: 'Create label', exact: true }).click()
  const label = page.locator('.dashboard-list li').filter({ hasText: slug })
  await expect(label).toContainText('Draft')
  const labels = Schema.decodeUnknownSync(LabelListResponse)(
    await (await page.request.get('/api/music/labels/manage')).json(),
  )
  const createdLabel = labels.find((item) => item.slug === slug)
  if (!createdLabel) throw new Error('Expected a created label')
  const createdAlbum = await page.request.post('/api/music/albums', {
    data: {
      title: 'A fixture album',
      slug,
      artistNames: ['Second Artist', 'First Artist'],
      releaseDate: '2026-02-03',
      genres: ['house'],
      albumType: 'album',
    },
  })
  expect(createdAlbum.ok()).toBe(true)
  const album = Schema.decodeUnknownSync(AlbumResponse)(await createdAlbum.json())
  try {
    await label.getByRole('link', { name: 'Edit', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/dashboard/music-entity/label/${createdLabel.id}$`))
    await page.getByRole('textbox', { name: 'content', exact: true }).fill('A label description.')
    await page.getByRole('textbox', { name: 'genres', exact: true }).fill('ambient, techno')
    await page.getByRole('button', { name: 'Save entity', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Entity saved.')
    await page.reload()
    await expect(page.getByRole('textbox', { name: 'genres', exact: true })).toHaveValue(
      'ambient, techno',
    )
    await page.getByRole('link', { name: '← Music catalog', exact: true }).click()
    await page.getByRole('link', { name: 'albums', exact: true }).click()
    await expect(page).toHaveURL(/tab=albums/)
    await page
      .locator('.dashboard-list li')
      .filter({ hasText: slug })
      .getByRole('link', { name: 'Edit', exact: true })
      .click()
    await expect(page.getByRole('textbox', { name: 'artistNames', exact: true })).toHaveValue(
      'Second Artist, First Artist',
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit album')
    await page.getByRole('textbox', { name: 'title', exact: true }).fill('Updated fixture album')
    await page.getByRole('textbox', { name: 'releaseDate', exact: true }).fill('2026-04-07')
    await page.getByRole('textbox', { name: 'genres', exact: true }).fill('')
    await page.getByRole('button', { name: 'Save entity', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'title', exact: true })).toHaveValue(
      'Updated fixture album',
    )
    await expect(page.getByRole('status')).toHaveText('Entity saved.')
    const saved = Schema.decodeUnknownSync(AlbumResponse)(
      await (await page.request.get(`/api/music/albums/${album.id}`)).json(),
    )
    expect(saved).toMatchObject({
      title: 'Updated fixture album',
      artistNames: ['Second Artist', 'First Artist'],
      releaseDate: '2026-04-07T00:00:00.000Z',
      genres: null,
    })
    await page.getByRole('textbox', { name: 'Platform', exact: true }).fill('bandcamp')
    await page
      .getByRole('textbox', { name: 'Link URL', exact: true })
      .fill('https://fixture.bandcamp.com/album/check')
    await page.getByRole('button', { name: 'Add link', exact: true }).click()
    await expect(page.locator('.dashboard-list')).toContainText(
      'https://fixture.bandcamp.com/album/check',
    )
    const links = Schema.decodeUnknownSync(EntityLinkListResponse)(
      await (await page.request.get(`/api/music/album/${album.id}/links`)).json(),
    )
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ platform: 'bandcamp', status: 'verified' })
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page
      .locator('.dashboard-list')
      .evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await testInfo.attach('catalog-links-light', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.getByRole('button', { name: 'Remove link', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Remove link', exact: true })).toHaveCount(0)
    await page
      .locator('summary')
      .filter({ hasText: /^Delete entity$/ })
      .click()
    await page.getByRole('button', { name: 'Confirm delete entity', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Entity deleted.')
    expect((await page.request.get(`/api/music/albums/${album.id}`)).status()).toBe(404)
  } finally {
    await page.request.delete(`/api/music/albums/${album.id}`)
    await page.request.delete(`/api/music/labels/${createdLabel.id}`)
  }
})
