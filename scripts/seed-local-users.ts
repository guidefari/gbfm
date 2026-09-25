import { Schema } from 'effect'

const SeedResponse = Schema.Struct({
  password: Schema.String,
  users: Schema.Array(
    Schema.Struct({
      email: Schema.String,
      username: Schema.String,
      role: Schema.Literals(['user', 'creator', 'editor', 'admin']),
    }),
  ),
})

const endpoint = new URL('/api/dev/seed', process.env.GBFM_API_URL ?? 'http://127.0.0.1:3003')
const response = await fetch(endpoint, { method: 'POST' })
if (!response.ok) throw new Error(`Local user seed failed (${response.status})`)

const result = Schema.decodeUnknownSync(SeedResponse)(await response.json())
console.table(result.users.map((user) => ({ ...user, password: result.password })))
