// import { api, authRouter } from "./api";
import { domain } from "./dns";

export const www = new sst.aws.StaticSite("gbfm-www", {
	path: "./web",
	build: {
		command: "bun run build",
		output: "dist",
	},
	environment: {
		// @ts-expect-error - should be fine
		// VITE_API_BASE_URL: api.url,
  VITE_API_BASE_URL: "yooo",
		// @ts-expect-error - should be fine
		// VITE_AUTH_BASE_URL: authRouter.url,
		VITE_AUTH_BASE_URL: "bu",
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
