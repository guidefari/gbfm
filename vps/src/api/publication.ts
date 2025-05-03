import { Hono } from 'hono'
import { db } from '../db'
import { publicationsTable, insertPublicationSchema } from '../db/publication.schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const publication = new Hono()

// GET /publications
publication.get('/', async (c) => {
  const publications = await db.select().from(publicationsTable)
  return c.json(publications)
})

// GET /publications/:id
publication.get('/:id', async (c) => {
  const id = c.req.param('id')
  const publication = await db.select().from(publicationsTable).where(eq(publicationsTable.id, id))


  if (!publication) {
    return c.json({ error: 'Publication not found' }, 404)
  }

  return c.json(publication)
})

// POST /publications
publication.post('/', async (c) => {
  const body = await c.req.json()
  const parsed = insertPublicationSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400)
  }

  const newPublication = await db
    .insert(publicationsTable)
    .values(parsed.data)
    .returning()

  return c.json(newPublication[0])
})

// PATCH /publications/:id
publication.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const parsed = insertPublicationSchema.partial().safeParse(body)

  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400)
  }

  const updated = await db
    .update(publicationsTable)
    .set(parsed.data)
    .where(eq(publicationsTable.id, id))
    .returning()

  if (!updated.length) {
    return c.json({ error: 'Publication not found' }, 404)
  }

  return c.json(updated[0])
})

// DELETE /publications/:id
publication.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const deleted = await db
    .delete(publicationsTable)
    .where(eq(publicationsTable.id, id))
    .returning()

  if (!deleted.length) {
    return c.json({ error: 'Publication not found' }, 404)
  }

  return c.json({ success: true })
})

export default publication