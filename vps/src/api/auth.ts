import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { authorsTable } from '../db/author.schema'
import { z } from 'zod'
import { Email } from '@gbfm/core/email/index'

const signupSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
})

export type SignupBody = z.infer<typeof signupSchema>

const auth = new Hono()

auth.post('/signup', async (c) => {
    const body = await c.req.json()
    const validated = signupSchema.parse(body)
    
    const existingUser = await db.select().from(authorsTable).where(eq(authorsTable.username, validated.username))

    if (existingUser.length > 0) {
      return c.json({ 
        error: 'Username already taken' 
      }, 400)
    }

    const hashedPassword = await Bun.password.hash(validated.password)

    const newAuthor = await db.insert(authorsTable).values({
      username: validated.username,
      password: hashedPassword,
      name: validated.username,
      email: validated.email,
    }).returning()

    await Email.send(
      "vps",
      validated.email,
      "Welcome to the gbfm cms!",
      `
        <h1>Welcome to the gbfm cms, ${validated.username}!</h1>
        <p>Thank you for joining our community. We're excited to have you on board!</p>
        <p>You can now log in and start exploring all our features.</p>
        <br>
        <p>Best regards,</p>
        <p>Guide</p>
      `
    )

    const { password, ...authorWithoutPassword } = newAuthor[0]

    return c.json({
      message: 'Signup successful',
      user: authorWithoutPassword
    }, 201)

})

const signinSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
})

auth.post('/signin', async (c) => {
  const body = await c.req.json()
  const validated = signinSchema.parse(body)

  const author = await db.select().from(authorsTable).where(eq(authorsTable.username, validated.username))

  if (author.length === 0) {
    return c.json({ error: 'Invalid username or password' }, 401)
  }

  if (!author[0].password) {
    return c.json({ error: 'No password set for this user' }, 401)
  }
  
  const isPasswordValid = await Bun.password.verify(validated.password, author[0].password)

  if (!isPasswordValid) {
    return c.json({ error: 'Invalid username or password' }, 401)
  }

  const { password, ...authorWithoutPassword } = author[0]

  // todo: return a jwt token and create a refresh token and a db session
  return c.json({
    message: 'Signin successful',
    user: authorWithoutPassword
  }, 200)
})

export default auth 
