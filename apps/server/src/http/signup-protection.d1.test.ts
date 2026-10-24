import { Effect, Layer, Redacted, Schema } from 'effect'
import { expect, test } from 'vitest'

import { user } from '@/db/auth.schema'
import { makeDatabaseClient } from '@/db/layer'
import { newsletterSubscribersTable } from '@/db/newsletter.schema'
import { EmailTransport, type OutboundEmailMessage } from '@/services/email-transport.service'
import { SignupProtectionLayer } from '@/services/signup-protection'
import { createTestWebHandler } from '@/test/http-handler'
import { createMigratedD1Database } from '@/test/migrate-d1'

test('only verified, rate-limited newsletter and account signups can persist or send mail', async () => {
  await using resource = await createMigratedD1Database()
  const messages: Array<OutboundEmailMessage> = []

  const transport = Layer.succeed(EmailTransport, {
    send: (message) =>
      Effect.sync(() => {
        messages.push(message)

        return { provider: 'cloudflare' as const, messageId: `recorded-${messages.length}` }
      }),
  })

  const attempts = new Map<string, number>()
  const redeemed = new Set<string>()

  const protection = SignupProtectionLayer({
    secret: Redacted.make('test-secret'),
    hostnames: ['goosebumps.fm'],
    limit: async (key) => {
      const count = (attempts.get(key) ?? 0) + 1
      attempts.set(key, count)

      return count <= 2
    },
    fetch: async (url, init) => {
      expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')

      const { response: token } = Schema.decodeUnknownSync(
        Schema.Struct({
          secret: Schema.Literal('test-secret'),
          response: Schema.String,
          remoteip: Schema.String,
        }),
      )(JSON.parse(Schema.decodeUnknownSync(Schema.String)(init.body)))

      if (token === 'outage') throw new Error('provider unavailable')

      if (token === 'malformed') return Response.json({ surprise: true })

      const success = token !== 'invalid' && !redeemed.has(token)
      redeemed.add(token)

      return Response.json({
        success,
        hostname: token === 'wrong-host' ? 'attacker.test' : 'goosebumps.fm',
        action: token.startsWith('account-')
          ? 'account-signup'
          : token === 'wrong-action'
            ? 'login'
            : 'newsletter-subscribe',
      })
    },
  })

  const handler = createTestWebHandler(
    resource.database,
    transport,
    undefined,
    undefined,
    undefined,
    protection,
  )

  const submit = async (email: string, token: string | undefined, ip = '192.0.2.1') => {
    const response = await handler.handler(
      new Request('https://api.goosebumps.fm/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
        body: JSON.stringify({ email, turnstileToken: token }),
      }),
    )

    await response.text()

    return response.status
  }

  try {
    expect(await submit('missing@example.test', undefined)).toBe(400)
    expect(await submit('invalid@example.test', 'invalid', '192.0.2.2')).toBe(403)
    expect(await submit('host@example.test', 'wrong-host', '192.0.2.3')).toBe(403)
    expect(await submit('action@example.test', 'wrong-action', '192.0.2.4')).toBe(403)
    expect(await submit('outage@example.test', 'outage', '192.0.2.5')).toBe(503)
    expect(await submit('malformed@example.test', 'malformed', '192.0.2.6')).toBe(503)
    expect(await submit('first@example.test', 'valid-first')).toBe(200)
    expect(await submit('second@example.test', 'valid-second')).toBe(200)
    expect(await submit('blocked@example.test', 'valid-blocked')).toBe(429)
    expect(await submit('other@example.test', 'valid-other', '192.0.2.7')).toBe(200)
    expect(await submit('replay@example.test', 'valid-first', '192.0.2.8')).toBe(403)

    const rows = await makeDatabaseClient(resource.database)
      .select()
      .from(newsletterSubscribersTable)

    expect(rows.map((row) => row.email).sort()).toEqual([
      'first@example.test',
      'other@example.test',
      'second@example.test',
    ])
    expect(messages).toHaveLength(6)

    const signup = async (email: string, token: string, path = '/auth/sign-up/email') => {
      const response = await handler.handler(
        new Request(`https://api.goosebumps.fm${path}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'cf-connecting-ip': '192.0.2.1',
            'x-captcha-response': token,
          },
          body: JSON.stringify({ email, name: 'Signup fixture', password: 'LocalTest123!' }),
        }),
      )

      await response.text()

      return response.status
    }

    expect(await signup('missing-account@example.test', '')).toBe(403)
    expect(
      await signup('cross-action@example.test', 'newsletter-token', '/auth/sign-up/email/'),
    ).toBe(403)
    // Newsletter attempts must not exhaust this IP's independent account-signup quota.
    expect(await signup('account@example.test', 'account-first')).toBe(200)
    expect(await signup('blocked-account@example.test', 'account-blocked')).toBe(429)
    expect(
      (await makeDatabaseClient(resource.database).select().from(user)).map((row) => row.email),
    ).toEqual(['account@example.test'])
    expect(messages).toHaveLength(8)
  } finally {
    await handler.dispose()
  }
}, 30_000)
