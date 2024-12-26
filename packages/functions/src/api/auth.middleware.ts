import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { AuthClient_API } from ".";
import { subjects } from "../subjects";

export const AuthMiddleware: MiddlewareHandler = async (c, next) => {
	const authorization = c.req.header("authorization");
	if (!authorization)
		throw new HTTPException(403, {
			message: "Authorization header is required.",
		});
	const token = authorization.split(" ")[1];
	if (!token)
		throw new HTTPException(403, {
			message: "Bearer token is required.",
		});

	const actor = await AuthClient_API.verify(subjects, token);
	if (actor.err) throw new HTTPException(403, { message: "Invalid token" });

	await next();
};
