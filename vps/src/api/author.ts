import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { db } from '../db';
import { authorsTable, zAuthorSchema } from "@/db/author.schema";

const app = new Hono();

export const createAuthorSchema = zAuthorSchema.omit({ id: true, createdAt: true, updatedAt: true, verified: true });

app.post('/', zValidator('json', createAuthorSchema), async (c) => {
	const data = c.req.valid('json');
	
	try {
		const [newAuthor] = await db
			.insert(authorsTable)
			.values(data)
			.returning();

		return c.json(newAuthor, 201);
	} catch (error) {
		if (error instanceof Error && error.message.includes('unique constraint')) {
			return c.json({ error: error.message }, 409);
		}
		
		return c.json({ error: 'Failed to create author' }, 500);
	}
});

app.get('/', async (c) => {
    const authors = await db.select().from(authorsTable);
	return c.json(authors);
});

export default app;