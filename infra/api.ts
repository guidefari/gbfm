import { domain } from "./dns";
import { allSecrets } from "./secret";
import { isPermanentStage } from "./stage";
import { www } from "./www";
import { bucket } from "./bucket";

// sst.Linkable.wrap(random.RandomString, (resource) => ({
// 	properties: {
// 		value: resource.result,
// 	},
// }));

const apiFn = new sst.aws.Function("OpenApi", {
	handler: "./packages/functions/src/api/index.handler",
	streaming: !$dev,
	url: true,
	link: [...allSecrets, www, bucket],
});

export const api = new sst.cloudflare.Worker("OpenApiWorker", {
	url: true,
	live: false,
	domain: `openapi.${domain}`,
	handler: "./packages/workers/src/proxy.ts",
	environment: {
		ORIGIN_URL: apiFn.url,
		NO_CACHE: String(isPermanentStage),
	},
});

export const outputs = {
	openapi: api.url,
};
