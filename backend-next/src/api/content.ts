import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { db } from '../db';
import { postsTable, postsToAuthors, zPostSchema } from '../db/post.schema';
import { z } from "zod";
import { arrayContains } from 'drizzle-orm';

const app = new Hono();

export const createPostSchema = zPostSchema.omit({ 
	id: true, 
	createdAt: true, 
	updatedAt: true,
}).extend({
	authorIds: z.string().array().min(1)
});

app.post('/', zValidator('json', createPostSchema), async (c) => {
	const { authorIds, ...postData } = c.req.valid('json');
	
	try {
		// Start a transaction since we need to insert into two tables
		const result = await db.transaction(async (tx) => {
			// Insert the post first
			const [newPost] = await tx
				.insert(postsTable)
				.values(postData)
				.returning();

			// Create author relationships for each authorId
			await tx
				.insert(postsToAuthors)
				.values(
					authorIds.map(authorId => ({
						postId: newPost.id,
						authorId: authorId
					}))
				);

			return newPost;
		});

		return c.json(result, 201);
	} catch (error) {
		if (error instanceof Error && error.message.includes('unique constraint')) {
			return c.json({ error: 'Slug or contentId already exists' }, 409);
		}
		
		return c.json({ error: `Failed to create post: ${error}` }, 500);
	}
});

app.get('/tag/:tag', async (c) => {
	const { tag } = c.req.param();
	
	try {
		const posts = await db
			.select()
			.from(postsTable)
			.where(arrayContains(postsTable.tags, [tag]));

		if (!posts.length) {
			return c.json({ posts: [], message: 'No posts found with this tag' }, 200);
		}

		return c.json({ posts }, 200);
	} catch (error) {
		console.error('Error fetching posts by tag:', error);
		return c.json({ error: 'Failed to fetch posts' }, 500);
	}
});

export default app;