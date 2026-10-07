import { expect, it } from 'vitest'

import { resetReadingHistory } from './tweet-reset'

const request = new Request('https://local.test/actions/tweet-reset')

it('clears reading history and starts over from the latest tweet', async () => {
  const calls: Array<{ path: string; method: string | undefined }> = []

  const result = await resetReadingHistory(request, 'a', async (_request, path, init) => {
    calls.push({ path, method: init.method })

    return Response.json({ reset: true }, { headers: { 'set-cookie': 'device=kept; Path=/' } })
  })

  expect(calls).toEqual([{ path: '/api/navigation/reading-history', method: 'DELETE' }])
  expect(result).toEqual({ location: '/tweet/latest', cookies: ['device=kept; Path=/'] })
})

it('returns to the current tweet with a failure notice when the reset does not land', async () => {
  const failing = await resetReadingHistory(
    request,
    'a',
    async () => new Response(null, { status: 500 }),
  )

  const throwing = await resetReadingHistory(request, 'a', async () => {
    throw new Error('offline')
  })

  expect(failing.location).toBe('/tweet/a?reset=failed')
  expect(throwing.location).toBe('/tweet/a?reset=failed')
})

it('falls back to the latest tweet when the current slug is unusable', async () => {
  const result = await resetReadingHistory(
    request,
    '../x',
    async () => new Response(null, { status: 500 }),
  )

  expect(result.location).toBe('/tweet/latest')
})
