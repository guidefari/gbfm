import { createRouter } from '@/lib/create-app'
import { db } from '@/db'
import { publicationsTable, insertPublicationSchema } from '@/db/publication.schema'
import { eq } from 'drizzle-orm'

const publication = createRouter()

publication.get('/', async (c) => {
  const publications = await db.select().from(publicationsTable)
  return c.json(publications)
})

publication.get('/:id', async (c) => {
  const id = c.req.param('id')
  const publication = await db.select().from(publicationsTable).where(eq(publicationsTable.id, id))


  if (!publication) {
    return c.json({ error: 'Publication not found' }, 404)
  }

  return c.json(publication)
})

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