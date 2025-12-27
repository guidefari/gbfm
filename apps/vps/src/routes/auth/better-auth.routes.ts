import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from '@/lib/auth'
import { corsConfig } from '@/lib/create-app'

const betterAuthApp = new Hono()

betterAuthApp.use('*', cors(corsConfig))

betterAuthApp.on(['POST', 'GET'], '*', (c) => {
  return auth.handler(c.req.raw)
})

export default betterAuthApp
