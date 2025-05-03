import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { authorsTable } from '../db/author.schema'
import { z } from 'zod'
import { client as emailClient } from '../email'

const signupSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
})

export type SignupBody = z.infer<typeof signupSchema>

const auth = new Hono()

auth.post('/signup', async (c) => {
  try {
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

    await emailClient.sendEmail({
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

  } catch (error) {
    console.error('Signup error:', error)
    return c.json({ 
      error: 'Failed to create user' 
    }, 500)
  }
})

export default auth 
