import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";

import { createPostSchema, tagParamsSchema, selectPostSchema } from "@/db/post.schema";
import { selectMixSchema } from "@/db/mix.schema";

const tags = ["Content"];

// Use schemas from database

const postResponseSchema = selectPostSchema;
const mixResponseSchema = selectMixSchema;

// tagParamsSchema imported from database

// Routes
export const createPost = createRoute({
  path: "/",
  method: "post",
  request: {
    body: jsonContentRequired(createPostSchema, "The post to create"),
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      postResponseSchema,
      "The created post",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      "Failed to create post",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createPostSchema),
      "Validation error",
    ),
  },
});

export const getPostsByTag = createRoute({
  path: "/tag/{tag}",
  method: "get",
  request: {
    params: tagParamsSchema,
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        posts: z.array(postResponseSchema),
        message: z.string().optional(),
      }),
      "Posts filtered by tag",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      "Failed to fetch posts",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(tagParamsSchema),
      "Invalid tag parameter",
    ),
  },
});

export const getMixes = createRoute({
  path: "/mixes",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(mixResponseSchema),
      "List of mixes",
    ),
  },
});

export const seedMixes = createRoute({
  path: "/seed-mixes",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ message: z.string() }),
      "Seed endpoint status",
    ),
  },
});

// Export types
export type CreatePostRoute = typeof createPost;
export type GetPostsByTagRoute = typeof getPostsByTag;
export type GetMixesRoute = typeof getMixes;
export type SeedMixesRoute = typeof seedMixes;