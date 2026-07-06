import { Hono } from 'hono'
import { auth, prepareAuthRequest } from '@/lib/auth'

const betterAuthApp = new Hono()

betterAuthApp.on(['POST', 'GET'], '*', async (c) => {
  return auth.handler(prepareAuthRequest(c.req.raw))
})

export default betterAuthApp
