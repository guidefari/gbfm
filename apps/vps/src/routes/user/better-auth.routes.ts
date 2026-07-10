import { Hono } from 'hono'
import { auth } from '@/lib/auth'

const betterAuthApp = new Hono()

function prepareAuthRequest(request: Request) {
  const hasOrigin = request.headers.has('origin') || request.headers.has('referer')

  if (request.method === 'POST' && !hasOrigin && request.headers.has('cookie')) {
    const headers = new Headers(request.headers)
    headers.delete('cookie')
    return new Request(request, { headers })
  }

  return request
}

betterAuthApp.on(['POST', 'GET'], '*', async (c) => {
  return auth.handler(prepareAuthRequest(c.req.raw))
})

export default betterAuthApp
