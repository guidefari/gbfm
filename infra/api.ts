import { domain } from "./dns";

// sst.Linkable.wrap(random.RandomString, (resource) => ({
// 	properties: {
// 		value: resource.result,
// 	},
// }));

const apiFn = new sst.aws.Function("OpenApi", {
	handler: "./packages/functions/src/api/index.handler",
	streaming: !$dev,
	url: true,
});

export const api = new sst.cloudflare.Worker("OpenApiWorker", {
	url: true,
	live: false,
	domain: `openapi.${domain}`,
	handler: "./packages/workers/src/proxy.ts",
	environment: {
		ORIGIN_URL: apiFn.url,
	},
});

export const outputs = {
	openapi: api.url,
};
