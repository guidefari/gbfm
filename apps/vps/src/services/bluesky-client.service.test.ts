import { Effect, Redacted } from 'effect'
import { describe, expect, test } from 'vitest'
import { IdentityResolutionError } from '@/errors'
import { makeBlueskyClient } from './bluesky-client.service'

const responses = new Map<string, unknown>([
  ['resolve', { did: 'did:plc:author' }],
  [
    'did',
    {
      service: [
        {
          id: '#atproto_pds',
          type: 'AtprotoPersonalDataServer',
          serviceEndpoint: 'https://pds.example.test'
        }
      ]
    }
  ],
  [
    'session',
    {
      did: 'did:plc:author',
      handle: 'author.bsky.social',
      accessJwt: 'access-token',
      refreshJwt: 'refresh-token'
    }
  ]
])

const fakeFetch = async (input: string | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input)
  if (url.includes('resolveHandle')) return Response.json(responses.get('resolve'))
  if (url.includes('plc.directory')) return Response.json(responses.get('did'))
  if (init?.body) expect(init.body).toContain('password')
  return Response.json(responses.get('session'))
}

describe('BlueskyClient', () => {
  test('resolves the PDS and verifies the login subject', async () => {
    const result = await Effect.runPromise(
      makeBlueskyClient(fakeFetch).login({
        handle: 'author.bsky.social',
        appPassword: Redacted.make('app-password')
      })
    )

    expect(result.did).toBe('did:plc:author')
    expect(result.serviceEndpoint).toBe('https://pds.example.test')
    expect(Redacted.value(result.accessJwt)).toBe('access-token')
  })

  test('reads an authored feed page with the verified access token', async () => {
    const result = await Effect.runPromise(
      makeBlueskyClient(async (input, init) => {
        expect(String(input)).toContain('getAuthorFeed')
        expect(init?.headers).toMatchObject({ authorization: 'Bearer access-token' })
        return Response.json({ feed: [{ post: { uri: 'at://post' } }], cursor: 'next-page' })
      }).getAuthorFeed({
        serviceEndpoint: 'https://pds.example.test',
        actorDid: 'did:plc:author',
        accessJwt: Redacted.make('access-token')
      })
    )

    expect(result.entries).toHaveLength(1)
    expect(result.cursor).toBe('next-page')
  })

  test('fails closed when the handle resolves to a different login identity', async () => {
    const client = makeBlueskyClient(async (input, init) => {
      const response = await fakeFetch(input, init)
      if (String(input).includes('server.createSession')) {
        return Response.json({
          did: 'did:plc:someone-else',
          handle: 'other.bsky.social',
          accessJwt: 'access-token',
          refreshJwt: 'refresh-token'
        })
      }
      return response
    })

    await expect(
      Effect.runPromise(
        client.login({ handle: 'author.bsky.social', appPassword: Redacted.make('secret') })
      )
    ).rejects.toBeInstanceOf(IdentityResolutionError)
  })
})
