import { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import { Effect, Result } from 'effect'
import { expect, test } from 'vitest'

import { ApiFailure, decodeApiResponse } from './api-response'

const decode = (response: Response) =>
  Effect.runPromise(Effect.result(decodeApiResponse(MicroPostNeighboursResponse)(response)))

test('decodes a successful response with the published schema', async () => {
  const result = await decode(
    Response.json({ back: null, forward: 'next-tweet', position: 3, total: 9, unreadCount: 4 }),
  )

  expect(result).toEqual(
    Result.succeed({ back: null, forward: 'next-tweet', position: 3, total: 9, unreadCount: 4 }),
  )
})

test('fails with the upstream status when the API rejects the request', async () => {
  const result = await decode(new Response(null, { status: 404 }))
  expect(result).toEqual(Result.fail(new ApiFailure({ status: 404 })))
})

test('fails as a bad gateway when the body does not match the schema', async () => {
  const result = await decode(Response.json({ back: 42 }))
  expect(result).toEqual(Result.fail(new ApiFailure({ status: 502 })))
})
