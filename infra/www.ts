import { api, authRouter } from "./api";
import { vps_gateway } from "./vps";
import { domain } from "./dns";
import { isLocal } from "./stage";

export const www = new sst.aws.StaticSite("gbfm-www", {
	path: "./web",
	build: {
		command: "bun run build",
		output: "dist",
	},
	environment: {
		// @ts-expect-error - should be fine
		VITE_API_BASE_URL: api.url,
		// @ts-expect-error - should be fine
		VITE_AUTH_BASE_URL: authRouter.url,
		VITE_VPS_BASE_URL: isLocal ? "http://localhost:3003" : vps_gateway.url,
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
