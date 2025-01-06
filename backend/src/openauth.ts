import { handle } from "hono/aws-lambda";
import { subjects } from "./subjects";
import { User } from "@gbfm/core/user/index.ts";
import { authorizer } from "@openauthjs/openauth";
import { CodeAdapter } from "@openauthjs/openauth/adapter/code";
import { PasswordAdapter } from "@openauthjs/openauth/adapter/password";
import { CodeUI } from "@openauthjs/openauth/ui/code";
import { PasswordUI } from "@openauthjs/openauth/ui/password";
import { Email } from "@gbfm/core/email/index.ts";
import { DynamoStorage } from "@openauthjs/openauth/storage/dynamo";
import { Resource } from "sst";

const app = authorizer({
	storage: DynamoStorage({
		table: Resource.UserTable.name,
	}),
	subjects,
	theme: {
		primary: "hsl(194, 52%, 67%)",
		background: "hsl(202, 61%, 22%)",
		favicon: "https://www.goosebumps.fm/fav.png",
		radius: "md",
		title: `goosebumps.fm - ${Resource.App.stage} login`,
		logo: "https://www.goosebumps.fm/fav.png",
	},
	providers: {
		code: CodeAdapter<{ email: string }>(
			CodeUI({
				sendCode: async (claims, code) => {
					await Email.send(
						"auth",
						claims.email,
						`goosebumps.fm code: ${code}`,
						`Your goosebumps.fm login code is ${code}`,
					);
				},
			}),
		),
		password: PasswordAdapter(
			PasswordUI({
				sendCode: async (email, code) => {
					console.log(email, code);
					await Email.send(
						"auth",
						email,
						`goosebumps.fm code: ${code}`,
						`Your goosebumps.fm login code is ${code}`,
					);
				},
			}),
		),
	},
	allow: async (input) => {
		const url = new URL(input.redirectURI);
		const hostname = url.hostname;
		if (hostname.endsWith("goosebumps.fm")) return true;
		if (hostname === "localhost") return true;
		return false;
	},

	async success(ctx, input) {
		User.setUserRepository("dynamo");
		let email = "";

		if (input.provider === "code") {
			email = input.claims.email.toLowerCase();
		} else if (input.provider === "password") {
			email = input.email.toLowerCase();
		}

		if (input.provider === "code" || input.provider === "password") {
			let user = await User.fromEmail(email);
			if (!user) {
				try {
					const accountID = await User.create(email);
					user = {
						id: accountID,
						email,
					};
				} catch (error) {
					console.error(error);
					return new Response("Failed to create user", {
						status: 500,
						headers: { "content-type": "text/plain" },
					});
				}
			}
			return ctx.subject("user", {
				id: user.id,
				email: user.email,
			});
		}

		return new Response("Not Supported", {
			status: 400,
			headers: { "content-type": "text/plain" },
		});
	},
});

export const handler = handle(app);
