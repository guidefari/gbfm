import { Effect, Layer } from 'effect'
import { HttpEffect, HttpServerResponse } from 'effect/unstable/http'
import { describe, expect, it } from 'vitest'
import { AuthLive } from '@/lib/auth'
import { ConfigServiceLayer } from '@/services/config.service'
import { DatabaseTestLayer } from '@/test/database'
import { IdentityResolver, IdentityResolverLive } from './optional-auth.impl'

const handler = HttpEffect.toWebHandler(
  Effect.gen(function* () {
    const resolver = yield* IdentityResolver
    const identity = yield* resolver.resolve
    return HttpServerResponse.jsonUnsafe(identity)
  }).pipe(
    Effect.provide(
      IdentityResolverLive.pipe(
        Layer.provide(
          AuthLive.pipe(Layer.provide(Layer.mergeAll(DatabaseTestLayer, ConfigServiceLayer)))
        )
      )
    )
  )
)

describe('IdentityResolver', () => {
  it('mints an anonymous device token and sets it in a secure httpOnly cookie', async () => {
    const response = await handler(
      new Request('https://vps.goosebumps.fm/api/content/posts/micro/navigate')
    )
    const cookie = response.headers.get('set-cookie')

    expect(await response.json()).toMatchObject({
      _tag: 'Anonymous',
      deviceToken: expect.any(String)
    })
    expect(cookie).toMatch(/^gbfm-navigation-device=[0-9a-f-]{36}/)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
  })

  it('uses an existing anonymous device token without setting a replacement cookie', async () => {
    const response = await handler(
      new Request('https://vps.goosebumps.fm/api/content/posts/micro/navigate', {
        headers: { cookie: 'gbfm-navigation-device=known-device' }
      })
    )

    expect(await response.json()).toEqual({ _tag: 'Anonymous', deviceToken: 'known-device' })
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})
