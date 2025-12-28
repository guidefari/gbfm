import { Hono } from 'hono'
import { auth } from '@/lib/auth'

const betterAuthApp = new Hono()

betterAuthApp.on(['POST', 'GET'], '*', (c) => {
  return auth.handler(c.req.raw)
})

export default betterAuthApp
