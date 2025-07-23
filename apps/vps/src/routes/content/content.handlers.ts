import { arrayContains } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";

import { db } from "@/db";
import { postsTable, postsToAuthors } from "@/db/post.schema";
import { mixesTable } from "@/db/mix.schema";

import type {
  CreatePostRoute,
  GetPostsByTagRoute,
  GetMixesRoute,
  SeedMixesRoute,
} from "./content.routes";

export const createPost: AppRouteHandler<CreatePostRoute> = async (c) => {
  const { authorIds, ...postData } = c.req.valid("json");

  try {
    // Start a transaction since we need to insert into two tables
    const result = await db.transaction(async (tx) => {
      // Insert the post first
      const [newPost] = await tx
        .insert(postsTable)
        .values(postData)
        .returning();

      // Insert the post-author relationships
      await tx.insert(postsToAuthors).values(
        authorIds.map((authorId: string) => ({
          postId: newPost.id,
          authorId,
        })),
      );

      return newPost;
    });

    return c.json(result, HttpStatusCodes.CREATED);
  } catch (error) {
    console.error("Error creating post:", error);
    return c.json(
      { error: `Failed to create post: ${error}` },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const getPostsByTag: AppRouteHandler<GetPostsByTagRoute> = async (c) => {
  const { tag } = c.req.valid("param");

  try {
    const posts = await db
      .select()
      .from(postsTable)
      .where(arrayContains(postsTable.tags, [tag]));

    if (!posts.length) {
      return c.json(
        { posts: [], message: "No posts found with this tag" },
        HttpStatusCodes.OK,
      );
    }

    return c.json({ posts }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Error fetching posts by tag:", error);
    return c.json(
      { error: "Failed to fetch posts" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const getMixes: AppRouteHandler<GetMixesRoute> = async (c) => {
  const mixes = await db.select().from(mixesTable);
  return c.json(mixes, HttpStatusCodes.OK);
};

export const seedMixes: AppRouteHandler<SeedMixesRoute> = async (c) => {
  return c.json({ message: "Seed endpoint disabled" }, HttpStatusCodes.OK);
};