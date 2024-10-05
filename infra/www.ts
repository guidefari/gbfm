import { api, authRouter } from "./api";
import { domain } from "./dns";

export const www = new sst.aws.StaticSite("gbfm-www", {
	path: "./packages/www",
	build: {
		command: "bun run build",
		output: "dist",
	},
	environment: {
		// @ts-expect-error - should be fine
		VITE_API_BASE_URL: api.url,
		// @ts-expect-error - should be fine
		VITE_AUTH_BASE_URL: authRouter.url,
	},
	domain: {
		name: `www.${domain}`,
		dns: sst.cloudflare.dns(),
		aliases: $app.stage === "prod" ? [domain] : undefined,
	},
});

export const outputs = {
	www: www.url,
};
