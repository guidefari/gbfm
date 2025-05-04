import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { authorsTable, authorPasswordResetTokensTable } from '../db/author.schema'
import { z } from 'zod'
import { Email } from '@gbfm/core/email/index'
import { randomUUID } from 'node:crypto'
import { getAuthorByEmailOrId } from '@/db/author.repo'

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

    await Email.send({
      from: "vps",
      to: validated.email,
      subject: "Welcome to the gbfm cms!",
      body: `
        <h1>Welcome to the gbfm cms, ${validated.username}!</h1>
        <p>Thank you for joining our community. We're excited to have you on board!</p>
        <p>You can now log in and start exploring all our features.</p>
        <br>
        <p>Best regards,</p>
        <p>Guide</p>
      `
    })

    const { password, ...authorWithoutPassword } = newAuthor[0]

    return c.json({
      message: 'Signup successful',
      user: authorWithoutPassword
    }, 201)

})

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

auth.post('/signin', async (c) => {
  const body = await c.req.json()
  const validated = signinSchema.parse(body)

  const author = await getAuthorByEmailOrId({email: validated.email})

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

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

auth.post('/forgot-password', async (c) => {
  const body = await c.req.json()
  const validated = forgotPasswordSchema.parse(body)

  const author = await db.select().from(authorsTable).where(eq(authorsTable.email, validated.email))
  if (author.length === 0)
    return c.json({ error: 'User not found' }, 404)

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

  await db.insert(authorPasswordResetTokensTable).values({
    authorId: author[0].id,
    token,
    expiresAt,
  })

  await Email.send({
    from: "vps",
    to: validated.email,
    subject: "Reset your password",
    body: `
      <h1>Reset your password</h1>
      ${token}
    `
  })

  return c.json({ message: 'Password reset email sent' }, 200)
})

const resetPasswordSchema = z.object({
  email: z.string().email().optional(),
  authorId: z.string().optional(),
  token: z.string().uuid(),
  password: z.string().min(8),
})

auth.post('/reset-password', async (c) => {
  const body = await c.req.json()
  const validated = resetPasswordSchema.parse(body)

  if (!validated.email && !validated.authorId)
    return c.json({ error: 'Email or authorId is required' }, 400)

  const author = await getAuthorByEmailOrId({email: validated.email, authorId: validated.authorId})

  if (author.length === 0)
    return c.json({ error: 'Invalid email or authorId' }, 400)
    

  const tokenRow = await db.select().from(authorPasswordResetTokensTable)
    .where(and(eq(authorPasswordResetTokensTable.token, validated.token), eq(authorPasswordResetTokensTable.authorId, author[0].id)))

  if (tokenRow.length === 0)
    return c.json({ error: 'Invalid or expired token' }, 401)

  const { authorId, expiresAt } = tokenRow[0]
  if (new Date(expiresAt) < new Date())
    return c.json({ error: 'Token expired' }, 401)

  const hashedPassword = await Bun.password.hash(validated.password)

  await db.update(authorsTable)
    .set({ password: hashedPassword })
    .where(eq(authorsTable.id, authorId))

  await db.delete(authorPasswordResetTokensTable)
    .where(eq(authorPasswordResetTokensTable.token, validated.token))

  return c.json({ message: 'Password reset successful' }, 200)
})

export default auth 
