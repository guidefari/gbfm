import { domain } from "./dns";

export const www = new sst.aws.StaticSite("gbfm-web", {
	path: "./packages/www",
	build: {
		command: "bun run build",
		output: "dist",
	},
	domain: {
		name: `www.${domain}`,
		dns: sst.cloudflare.dns(),
		aliases: $app.stage === "production" ? [domain] : undefined,
	},
});

export const outputs = {
	www: www.url,
};
