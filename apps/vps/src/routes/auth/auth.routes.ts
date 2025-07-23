import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";

import {
  signupSchema,
  signinSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  selectAuthorSchema,
} from "@/db/author.schema";

const tags = ["Auth"];

// Response schemas
const authResponseSchema = z.object({
  user: selectAuthorSchema.omit({ password: true }),
  accessToken: z.string(),
  refreshToken: z.string(),
});

const messageResponseSchema = z.object({
  message: z.string(),
});

const userResponseSchema = selectAuthorSchema.omit({ password: true });

export const signup = createRoute({
  path: "/signup",
  method: "post",
  request: {
    body: jsonContentRequired(signupSchema, "User signup data"),
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        message: z.string(),
        user: userResponseSchema,
      }),
      "User created successfully",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      "Username already taken",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(signupSchema),
      "Validation error",
    ),
  },
});

export const signin = createRoute({
  path: "/signin",
  method: "post",
  request: {
    body: jsonContentRequired(signinSchema, "User signin data"),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      authResponseSchema,
      "Successful authentication",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      "Invalid credentials",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(signinSchema),
      "Validation error",
    ),
  },
});

export const forgotPassword = createRoute({
  path: "/forgot-password",
  method: "post",
  request: {
    body: jsonContentRequired(forgotPasswordSchema, "Email for password reset"),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      messageResponseSchema,
      "Password reset email sent",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      "User not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(forgotPasswordSchema),
      "Validation error",
    ),
  },
});

export const resetPassword = createRoute({
  path: "/reset-password",
  method: "post",
  request: {
    body: jsonContentRequired(resetPasswordSchema, "Password reset data"),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      messageResponseSchema,
      "Password reset successful",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      "Invalid request",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      "Invalid or expired token",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(resetPasswordSchema),
      "Validation error",
    ),
  },
});

export const refreshToken = createRoute({
  path: "/refresh-token",
  method: "post",
  request: {
    body: jsonContentRequired(refreshTokenSchema, "Refresh token data"),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ accessToken: z.string() }),
      "New access token",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      "Refresh token required",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      "Invalid refresh token",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      "User not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(refreshTokenSchema),
      "Validation error",
    ),
  },
});

// Export types for handlers
export type SignupRoute = typeof signup;
export type SigninRoute = typeof signin;
export type ForgotPasswordRoute = typeof forgotPassword;
export type ResetPasswordRoute = typeof resetPassword;
export type RefreshTokenRoute = typeof refreshToken;