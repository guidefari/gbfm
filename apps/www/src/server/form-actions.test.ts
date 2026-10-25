import { createServer } from 'node:http'

import { Schema } from 'effect'
import { expect, it } from 'vitest'

import { handleFormAction } from './form-actions'

it('rejects a subscription without browser verification before making an API call', async () => {
  const result = await handleFormAction(
    new Request('https://www.test/actions/subscribe', {
      method: 'POST',
      headers: { origin: 'https://www.test' },
      body: new URLSearchParams({ email: 'reader@example.test' }),
    }),
  )

  expect(result.response.status).toBe(400)
  expect(await result.response.text()).toContain('Browser verification is required')
})

it('rejects account signup without a challenge token before forwarding credentials', async () => {
  const result = await handleFormAction(
    new Request('https://www.test/auth/sign-up', {
      method: 'POST',
      headers: { origin: 'https://www.test' },
      body: new URLSearchParams({ email: 'reader@example.test', password: 'LocalTest123!' }),
    }),
  )

  expect(result.response.status).toBe(400)
})

it('forwards the challenge token and original Cloudflare IP, not spoofed form or forwarding headers', async () => {
  const received: Array<{
    body: string
    ip: string | Array<string> | undefined
    forwarded: string | Array<string> | undefined
  }> = []

  const server = createServer(async (request, response) => {
    let body = ''

    for await (const chunk of request) body += chunk
    received.push({
      body,
      ip: request.headers['cf-connecting-ip'],
      forwarded: request.headers['x-forwarded-for'],
    })
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end('{}')
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = Schema.decodeUnknownSync(Schema.Struct({ port: Schema.Number }))(server.address())
  const previous = process.env.VPS_PROXY_TARGET
  process.env.VPS_PROXY_TARGET = `http://127.0.0.1:${address.port}`

  try {
    const result = await handleFormAction(
      new Request('https://www.test/actions/subscribe', {
        method: 'POST',
        headers: {
          origin: 'https://www.test',
          'cf-connecting-ip': '203.0.113.4',
          'x-forwarded-for': '198.51.100.9',
        },
        body: new URLSearchParams({
          email: 'reader@example.test',
          name: 'Reader',
          'cf-turnstile-response': 'challenge-token',
          'cf-connecting-ip': '198.51.100.8',
        }),
      }),
    )

    expect(result.response.status).toBe(303)
    expect(result.response.headers.get('location')).toBe('/subscribe?complete=1')
    expect(received).toEqual([
      {
        body: JSON.stringify({
          email: 'reader@example.test',
          name: 'Reader',
          turnstileToken: 'challenge-token',
        }),
        ip: '203.0.113.4',
        forwarded: undefined,
      },
    ])
  } finally {
    if (previous === undefined) delete process.env.VPS_PROXY_TARGET
    else process.env.VPS_PROXY_TARGET = previous
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})

it('forwards signup verification in headers without changing the auth payload, preserving guard failures', async () => {
  const received: Array<{
    path: string | undefined
    body: string
    captcha: string | Array<string> | undefined
    ip: string | Array<string> | undefined
  }> = []

  let status = 200

  const server = createServer(async (request, response) => {
    let body = ''

    for await (const chunk of request) body += chunk
    received.push({
      path: request.url,
      body,
      captcha: request.headers['x-captcha-response'],
      ip: request.headers['cf-connecting-ip'],
    })
    response.writeHead(status, {
      'content-type': 'application/json',
      'set-cookie': 'session=fixture; Path=/',
    })
    response.end('{}')
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  const { port } = Schema.decodeUnknownSync(Schema.Struct({ port: Schema.Number }))(
    server.address(),
  )

  const previous = process.env.VPS_PROXY_TARGET
  process.env.VPS_PROXY_TARGET = `http://127.0.0.1:${port}`

  try {
    for (const code of [200, 403, 429, 503]) {
      status = code

      const result = await handleFormAction(
        new Request('https://www.test/auth/sign-up', {
          method: 'POST',
          headers: { origin: 'https://www.test' },
          body: new URLSearchParams({
            email: 'reader@example.test',
            password: 'LocalTest123!',
            name: 'Reader',
            'cf-turnstile-response': 'signup-token',
            returnTo: '/dashboard',
          }),
        }),
      )

      expect(result.response.status).toBe(code === 200 ? 303 : code)
      expect(result.response.headers.get('location')).toBe(code === 200 ? '/dashboard' : null)
      expect(result.response.headers.getSetCookie()).toEqual(
        code === 200 ? ['session=fixture; Path=/'] : [],
      )
    }

    expect(received).toHaveLength(4)

    for (const request of received) {
      expect(request).toEqual({
        path: '/auth/sign-up/email',
        captcha: 'signup-token',
        ip: '127.0.0.1',
        body: JSON.stringify({
          email: 'reader@example.test',
          password: 'LocalTest123!',
          name: 'Reader',
          token: '',
          newPassword: 'LocalTest123!',
          redirectTo: 'https://www.test/auth/reset-password',
        }),
      })
    }
  } finally {
    if (previous === undefined) delete process.env.VPS_PROXY_TARGET
    else process.env.VPS_PROXY_TARGET = previous
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})
