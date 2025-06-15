import { domain } from "./dns";
import { allSecrets } from "./secret";
import { isPermanentStage } from "./stage";
import { bucket, contentBucket, mixesBucket, fileRouter } from "./bucket";
import { email } from "./email";
import { secret } from "./secret";
import { ContentTable, UserTable } from "./dynamo";

if (!domain) throw new Error("no custom domain provided, what you doing blud?");

export const auth = new sst.aws.Auth("Auth", {
	authorizer: {
		link: [email, secret.SquealDBUrl, UserTable],
		handler: "./backend/src/openauth.handler",
		permissions: [
			{
				actions: ["ses:SendEmail"],
				resources: ["*"],
			},
		],
	},
	forceUpgrade: "v2",
});

const apiFn = new sst.aws.Function("Api", {
	handler: "./backend/src/api/index.handler",
	streaming: !$dev,
	url: true,
	link: [...allSecrets, bucket, auth, UserTable, ContentTable, contentBucket, mixesBucket, fileRouter],
});

// export const api = new sst.cloudflare.Worker("ApiWorker", {
// 	url: true,
// 	domain: `api.${domain}`,
// 	handler: "./backend/src/proxy.ts",
// 	environment: {
// 		ORIGIN_URL: apiFn.url,
// 		NO_CACHE: String(isPermanentStage),
// 	},
// });

// export const authRouter = new sst.cloudflare.Worker("AuthWorkerCF", {
// 	url: true,
// 	dev: false,
// 	domain: `auth.${domain}`,
// 	handler: "./backend/src/proxy.ts",
// 	environment: {
// 		ORIGIN_URL: auth.url,
// 	},
// });

export const outputs = {
	// auth: authRouter.url,
	// api: api.url,
	// swagger: api.url.apply(url => `${url}/swag`),
};
