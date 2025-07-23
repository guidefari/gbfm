import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";

import { createMixSchema, selectMixSchema } from "@/db/mix.schema";

const tags = ["Mix"];

export const create = createRoute({
  path: "/",
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

export const uploadForm = createRoute({
  path: "/upload",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        "text/html": {
          schema: z.string(),
        },
      },
      description: "Upload form HTML",
    },
  },
});

export const processUpload = createRoute({
  path: "/process",
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
    [HttpStatusCodes.REQUEST_ENTITY_TOO_LARGE]: {
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

// Export types for handlers  
export type CreateRoute = typeof create;
export type UploadFormRoute = typeof uploadForm;
export type ProcessUploadRoute = typeof processUpload;