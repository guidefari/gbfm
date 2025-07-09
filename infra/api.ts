import { bucket, contentBucket, fileRouter, mixesBucket } from "./bucket";
import { domain } from "./dns";
import { ContentTable, UserTable } from "./dynamo";
import { allSecrets } from "./secret";
import { isPermanentStage } from "./stage";

if (!domain) throw new Error("no custom domain provided, what you doing blud?");

const apiFn = new sst.aws.Function("Api", {
	handler: "./backend/src/api/index.handler",
	streaming: !$dev,
	url: true,
	link: [
		...allSecrets,
		bucket,
		UserTable,
		ContentTable,
		contentBucket,
		mixesBucket,
		fileRouter,
	],
});

export const api = new sst.cloudflare.Worker("ApiWorker", {
	url: true,
	domain: `api.${domain}`,
	handler: "./backend/src/proxy.ts",
	environment: {
		ORIGIN_URL: apiFn.url,
		NO_CACHE: String(isPermanentStage),
	},
});

export const outputs = {
	api: api.url,
	swagger: api.url.apply((url) => `${url}/swag`),
};
