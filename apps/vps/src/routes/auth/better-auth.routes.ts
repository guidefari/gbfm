import { Hono } from 'hono'
import { auth } from '@/lib/auth'

const betterAuthApp = new Hono()

betterAuthApp.all('*', async (c) => {
  return auth.handler(c.req.raw)
})

export default betterAuthApp
