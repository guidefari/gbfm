import { expect, it } from 'vitest'

import { randomTweet } from './tweet-random'

const request = new Request('https://local.test/actions/tweet-random', {
  headers: { cookie: 'existing=value' },
})

it('awaits the seen write and carries a minted device cookie to random and the redirect', async () => {
  const calls: Array<{ path: string; method: string | undefined; cookie: string | null }> = []

  const result = await randomTweet(request, 'a', async (forwarded, path, init) => {
    calls.push({ path, method: init.method, cookie: forwarded.headers.get('cookie') })

    if (path.endsWith('/seen')) {
      return Response.json(
        { recorded: true },
        { headers: { 'set-cookie': 'device=minted; HttpOnly; Secure; Path=/' } },
      )
    }

    return Response.json({ slug: 'b' })
  })

  expect(result.location).toBe('/tweet/b')
  expect(calls).toEqual([
    { path: '/api/content/posts/micro/a/seen', method: 'POST', cookie: 'existing=value' },
    {
      path: '/api/content/posts/micro/a/random',
      method: 'GET',
      cookie: 'existing=value; device=minted',
    },
  ])
  expect(result.cookies).toEqual(['device=minted; HttpOnly; Secure; Path=/'])
})

it('distinguishes authoritative random exhaustion from failures and stops after failed seen writes', async () => {
  for (const status of [404, 500]) {
    const result = await randomTweet(request, 'a', async (_request, path) =>
      path.endsWith('/seen') ? Response.json({ recorded: true }) : new Response(null, { status }),
    )

    expect(result.location).toBe(`/tweet/a?random=${status === 404 ? 'exhausted' : 'unavailable'}`)
  }

  for (const seen of [
    new Response(null, { status: 500 }),
    Response.json({ recorded: false }),
    Response.json({ invalid: true }),
  ]) {
    const paths: Array<string> = []

    const result = await randomTweet(request, 'a', async (_request, path) => {
      paths.push(path)

      return seen
    })

    expect(result.location).toBe('/tweet/a?random=unavailable')
    expect(paths).toEqual(['/api/content/posts/micro/a/seen'])
  }

  expect(
    (
      await randomTweet(request, 'a', async () => {
        throw new Error('Network down')
      })
    ).location,
  ).toBe('/tweet/a?random=unavailable')
})
