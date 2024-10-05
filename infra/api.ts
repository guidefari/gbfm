import { domain } from "./dns";
import { allSecrets } from "./secret";
import { isPermanentStage } from "./stage";
import { bucket } from "./bucket";
// import { bus } from "./events";
// import { database } from "./database";
import { email } from "./email";
import { secret } from "./secret";

if (!domain) throw new Error("no custom domain provided, what you doing blud?");

// sst.Linkable.wrap(random.RandomString, (resource) => ({
// 	properties: {
// 		value: resource.result,
// 	},
// }));

export const auth = new sst.aws.Auth("Auth", {
	authenticator: {
		link: [email, secret.SquealDBUrl],
		handler: "./packages/functions/src/auth.handler",
		permissions: [
			{
				actions: ["ses:SendEmail"],
				resources: ["*"],
			},
		],
	},
});

const apiFn = new sst.aws.Function("OpenApi", {
	handler: "./packages/functions/src/api/index.handler",
	streaming: !$dev,
	url: true,
	link: [...allSecrets, bucket, auth],
});

export const api = new sst.cloudflare.Worker("OpenApiWorker", {
	url: true,
	// live: false,
	// link: [...allSecrets, bucket, auth],
	domain: `openapi.${domain}`,
	handler: "./packages/workers/src/proxy.ts",
	environment: {
		ORIGIN_URL: apiFn.url,
		NO_CACHE: String(isPermanentStage),
	},
});

// export const authRouter = new sst.aws.Router("AuthRouter", {
//   domain: {
//     name: `auth.${domain}`,
//     dns: sst.cloudflare.dns(),
//   },
//   routes: { "/*": auth.url },
// })

export const authRouter = new sst.cloudflare.Worker("AuthWorkerCF", {
	url: true,
	dev: false,
	domain: `auth.${domain}`,
	handler: "./packages/workers/src/proxy.ts",
	environment: {
		ORIGIN_URL: auth.url,
	},
});

export const outputs = {
	auth: authRouter.url,
	openapi: api.url,
};
