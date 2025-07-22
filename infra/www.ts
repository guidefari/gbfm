import { domain } from "./dns";
import { isLocal } from "./stage";
import { vps_gateway } from "./vps";

export const www = new sst.aws.StaticSite("gbfm-www", {
	path: "./apps/www",
	build: {
		command: "bun run build",
		output: "dist",
	},
	environment: {
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
