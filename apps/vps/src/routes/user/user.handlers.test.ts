import { Exit } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as runtime from '@/runtime'

import { getSocialLinks, replaceSocialLinks } from './user.handlers'

type TestContext = {
  get: (key: string) => unknown
  json: (body: unknown, status: number) => { body: unknown; status: number }
  req: {
    valid: (key: string) => unknown
  }
}

type TestResponse = {
  status: number
  body: unknown
}

type TestHandler = (c: unknown, next?: unknown) => Promise<TestResponse>

const createContext = ({
  user,
  jsonBody
}: {
  user?: { id: string }
  jsonBody?: unknown
}): TestContext => ({
  get: (key: string) => (key === 'user' ? user : undefined),
  json: (body: unknown, status: number) => ({ body, status }),
  req: {
    valid: (key: string) => (key === 'json' ? jsonBody : undefined)
  }
})

describe('user.handlers social links', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 401 from getSocialLinks when user is missing', async () => {
    const c = createContext({})
    const response = await Reflect.apply(getSocialLinks, undefined, [c, undefined])
    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED)
  })

  it('returns social links from getSocialLinks', async () => {
    vi.spyOn(runtime.AppRuntime, 'runPromiseExit').mockResolvedValueOnce(
      Exit.succeed([
        {
          platform: 'soundcloud',
          url: 'https://soundcloud.com/example',
          position: 0
        }
      ])
    )

    const c = createContext({ user: { id: 'user_1' } })
    const response = await Reflect.apply(getSocialLinks, undefined, [c, undefined])

    expect(response.status).toBe(HttpStatusCodes.OK)
    expect(response.body).toEqual([
      {
        platform: 'soundcloud',
        url: 'https://soundcloud.com/example',
        position: 0
      }
    ])
  })

  it('returns 401 from replaceSocialLinks when user is missing', async () => {
    const c = createContext({})
    const response = await Reflect.apply(replaceSocialLinks, undefined, [c, undefined])
    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED)
  })

  it('returns replaced links from replaceSocialLinks', async () => {
    vi.spyOn(runtime.AppRuntime, 'runPromiseExit').mockResolvedValueOnce(
      Exit.succeed([
        {
          platform: 'instagram',
          url: 'https://instagram.com/example',
          position: 0
        }
      ])
    )

    const c = createContext({
      user: { id: 'user_1' },
      jsonBody: [
        {
          platform: 'instagram',
          url: 'https://instagram.com/example',
          position: 0
        }
      ]
    })

    const response = await Reflect.apply(replaceSocialLinks, undefined, [c, undefined])

    expect(response.status).toBe(HttpStatusCodes.OK)
    expect(response.body).toEqual([
      {
        platform: 'instagram',
        url: 'https://instagram.com/example',
        position: 0
      }
    ])
  })
})
