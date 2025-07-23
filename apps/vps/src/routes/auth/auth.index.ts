import { randomUUID } from "node:crypto";
import { getAuthorByEmailOrId } from "@/db/author.repo";
import { env } from "@/env";
import { Email } from "@gbfm/core/email/index.tsx";
import { and, eq } from "drizzle-orm";
import { createRouter } from "@/lib/create-app";
import { sign, verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";
import { z } from "zod";
import { db } from "@/db";
import {
	authorPasswordResetTokensTable,
	authorSessionsTable,
	authorsTable,
} from "@/db/author.schema";

const signupSchema = z.object({
	username: z.string().min(3).max(50),
	email: z.string().email(),
	password: z.string().min(8),
});

export type SignupBody = z.infer<typeof signupSchema>;

const auth = createRouter();

const ACCESS_TOKEN_EXPIRES_IN = 60 * 15; // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days

auth.post("/signup", async (c) => {
	const body = await c.req.json();
	const validated = signupSchema.parse(body);

	const existingUser = await db
		.select()
		.from(authorsTable)
		.where(eq(authorsTable.username, validated.username));

	if (existingUser.length > 0) {
		return c.json(
			{
				error: "Username already taken",
			},
			400,
		);
	}

	const hashedPassword = await Bun.password.hash(validated.password);

	const newAuthor = await db
		.insert(authorsTable)
		.values({
			username: validated.username,
			password: hashedPassword,
			name: validated.username,
			email: validated.email,
		})
		.returning();

	await Email.send({
		from: "vps",
		to: validated.email,
		subject: "Welcome to the gbfm cms!",
		body: `
			<h1>Welcome to the gbfm cms, ${validated.username}!</h1>
			<p>Thank you for joining our community. We're excited to have you on board!</p>
			<p>You can now log in and start exploring all our features.</p>
			<br>
			<p>Best regards,</p>
			<p>Guide</p>
		  `,
	});

	// await sendWelcomeEmail({
	// 	to: validated.email,
	// 	username: validated.username,
	// 	loginUrl: `${env.FRONTEND_URL}/auth/signin`,
	// });

	const { password, ...authorWithoutPassword } = newAuthor[0];

	return c.json(
		{
			message: "Signup successful",
			user: authorWithoutPassword,
		},
		201,
	);
});

const signinSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

auth.post("/signin", async (c) => {
	const body = await c.req.json();
	const validated = signinSchema.parse(body);

	const author = await getAuthorByEmailOrId({ email: validated.email });

	if (author.length === 0 || !author[0].password)
		return c.json({ error: "Invalid username or password" }, 401);

	const isPasswordValid = await Bun.password.verify(
		validated.password,
		author[0].password,
	);
	if (!isPasswordValid)
		return c.json({ error: "Invalid username or password" }, 401);

	const { password, ...authorWithoutPassword } = author[0];

	const now = Math.floor(Date.now() / 1000);
	const accessToken = await sign(
		{
			sub: author[0].id,
			email: author[0].email,
			type: "access",
			exp: now + ACCESS_TOKEN_EXPIRES_IN,
			iat: now,
		},
		env.ACCESS_TOKEN_SECRET,
	);

	const refreshToken = await sign(
		{
			sub: author[0].id,
			email: author[0].email,
			type: "refresh",
			exp: now + REFRESH_TOKEN_EXPIRES_IN,
			iat: now,
		},
		env.REFRESH_TOKEN_SECRET,
	);

	const userAgent = c.req.header("user-agent");
	const forwarded = c.req.header("x-forwarded-for");
	const ip = forwarded ? forwarded.split(",")[0].trim() : undefined;

	await db.insert(authorSessionsTable).values({
		authorId: author[0].id,
		refreshToken,
		userAgent,
		ip,
		expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000),
	});

	return c.json(
		{
			user: authorWithoutPassword,
			accessToken,
			refreshToken,
		},
		200,
	);
});

const forgotPasswordSchema = z.object({
	email: z.string().email(),
});

auth.post("/forgot-password", async (c) => {
	const body = await c.req.json();
	const validated = forgotPasswordSchema.parse(body);

	const author = await db
		.select()
		.from(authorsTable)
		.where(eq(authorsTable.email, validated.email));
	if (author.length === 0) return c.json({ error: "User not found" }, 404);

	await db
		.delete(authorPasswordResetTokensTable)
		.where(eq(authorPasswordResetTokensTable.authorId, author[0].id));

	const token = randomUUID();
	const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

	await db.insert(authorPasswordResetTokensTable).values({
		authorId: author[0].id,
		token,
		expiresAt,
	});

	await Email.send({
		from: "vps",
		to: validated.email,
		subject: "Reset your password",
		body: `
      <h1>Reset your password</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${env.FRONTEND_URL}/auth/reset-password?token=${token}&email=${validated.email}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
	});

	// const resetUrl = `${env.FRONTEND_URL}/auth/reset-password?token=${token}&email=${validated.email}`;

	// await Email.sendPasswordResetEmail({
	// 	to: validated.email,
	// 	resetUrl,
	// 	expiresIn: "1 hour",
	// });

	return c.json({ message: "Password reset email sent" }, 200);
});

const resetPasswordSchema = z.object({
	email: z.string().email().optional(),
	authorId: z.string().optional(),
	token: z.string().uuid(),
	password: z.string().min(8),
});

auth.post("/reset-password", async (c) => {
	const body = await c.req.json();
	const validated = resetPasswordSchema.parse(body);

	if (!validated.email && !validated.authorId)
		return c.json({ error: "Email or authorId is required" }, 400);

	const author = await getAuthorByEmailOrId({
		email: validated.email,
		authorId: validated.authorId,
	});

	if (author.length === 0)
		return c.json({ error: "Invalid email or authorId" }, 400);

	const tokenRow = await db
		.select()
		.from(authorPasswordResetTokensTable)
		.where(
			and(
				eq(authorPasswordResetTokensTable.token, validated.token),
				eq(authorPasswordResetTokensTable.authorId, author[0].id),
			),
		);

	if (tokenRow.length === 0)
		return c.json({ error: "Invalid or expired token" }, 401);

	const { authorId, expiresAt } = tokenRow[0];
	if (new Date(expiresAt) < new Date())
		return c.json({ error: "Token expired" }, 401);

	const hashedPassword = await Bun.password.hash(validated.password);

	await db
		.update(authorsTable)
		.set({ password: hashedPassword })
		.where(eq(authorsTable.id, authorId));

	await db
		.delete(authorPasswordResetTokensTable)
		.where(eq(authorPasswordResetTokensTable.authorId, authorId));

	return c.json({ message: "Password reset successful" }, 200);
});

auth.post("/refresh-token", async (c) => {
	const { refreshToken } = await c.req.json();

	if (!refreshToken) return c.json({ error: "Refresh token required" }, 400);

	let payload: JWTPayload;
	try {
		payload = await verify(refreshToken, env.REFRESH_TOKEN_SECRET);
	} catch {
		return c.json({ error: "Invalid refresh token" }, 401);
	}

	const session = await db
		.select()
		.from(authorSessionsTable)
		.where(eq(authorSessionsTable.refreshToken, refreshToken));

	if (session.length === 0 || new Date(session[0].expiresAt) < new Date())
		return c.json({ error: "Session expired or not found" }, 401);

	const authorId = payload.sub;

	if (!authorId || typeof authorId !== "string")
		return c.json({ error: "Invalid payload" }, 401);

	const author = await getAuthorByEmailOrId({ authorId });

	if (author.length === 0) return c.json({ error: "User not found" }, 404);

	const now = Math.floor(Date.now() / 1000);
	const accessToken = await sign(
		{
			sub: author[0].id,
			email: author[0].email,
			type: "access",
			exp: now + ACCESS_TOKEN_EXPIRES_IN,
			iat: now,
		},
		env.ACCESS_TOKEN_SECRET,
	);

	return c.json({ accessToken }, 200);
});

export default auth;
