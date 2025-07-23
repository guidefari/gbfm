import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, IdParamsSchema } from "stoker/openapi/schemas";

import { createPublicationSchema, updatePublicationSchema } from "@/db/publication.schema";

const tags = ["Publications"];

// Response schema based on the database schema
const publicationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Routes
export const list = createRoute({
  path: "/",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(publicationResponseSchema),
      "List of publications",
    ),
  },
});

export const getOne = createRoute({
  path: "/{id}",
  method: "get",
  request: {
    params: IdParamsSchema,
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(publicationResponseSchema),
      "The requested publication",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      "Publication not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      "Invalid id error",
    ),
  },
});

export const create = createRoute({
  path: "/",
  method: "post",
  request: {
    body: jsonContentRequired(
      createPublicationSchema,
      "The publication to create",
    ),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      publicationResponseSchema,
      "The created publication",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createPublicationSchema),
      "Validation error",
    ),
  },
});

export const patch = createRoute({
  path: "/{id}",
  method: "patch",
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(
      updatePublicationSchema,
      "The publication updates",
    ),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      publicationResponseSchema,
      "The updated publication",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      "Publication not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(updatePublicationSchema)
        .or(createErrorSchema(IdParamsSchema)),
      "Validation error",
    ),
  },
});

export const remove = createRoute({
  path: "/{id}",
  method: "delete",
  request: {
    params: IdParamsSchema,
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      publicationResponseSchema,
      "The deleted publication",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      "Publication not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      "Invalid id error",
    ),
  },
});

// Export types
export type ListRoute = typeof list;
export type GetOneRoute = typeof getOne;
export type CreateRoute = typeof create;
export type PatchRoute = typeof patch;
export type RemoveRoute = typeof remove;