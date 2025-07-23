import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";

import { createPostSchema, tagParamsSchema, selectPostSchema } from "@/db/post.schema";
import { selectMixSchema, createMixSchema } from "@/db/mix.schema";

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

export const createMix = createRoute({
  path: "/mixes",
  method: "post",
  request: {
    body: jsonContentRequired(createMixSchema, "The mix to create"),
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectMixSchema,
      "The created mix",
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      z.object({ error: z.string() }),
      "Mix with this slug already exists or invalid author id",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      "Failed to create mix",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createMixSchema),
      "Validation error",
    ),
  },
});

export const processMixUpload = createRoute({
  path: "/mixes/process",
  method: "post",
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            title: z.string(),
            artist: z.string().optional(),
            album: z.string().optional(),
            description: z.string(),
            outputFormat: z.enum(["mp3", "mp4"]),
            audioFile: z.any(),
            coverImage: z.any(),
          }),
        },
      },
    },
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        "audio/mpeg": {
          schema: z.string().openapi({ format: "binary" }),
        },
        "video/mp4": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
      description: "Processed audio/video file",
    },
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      "Processing error",
    ),
    [HttpStatusCodes.IM_A_TEAPOT]: {
      content: {
        "text/plain": {
          schema: z.string(),
        },
      },
      description: "File too large",
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      "Failed to process upload",
    ),
  },
});

// Export types
export type CreatePostRoute = typeof createPost;
export type GetPostsByTagRoute = typeof getPostsByTag;
export type GetMixesRoute = typeof getMixes;
export type SeedMixesRoute = typeof seedMixes;
export type CreateMixRoute = typeof createMix;
export type ProcessMixUploadRoute = typeof processMixUpload;