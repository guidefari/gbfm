// import  from './bucket'

import { domain, urls } from "./dns";
import { email } from "./email";
import { allSecrets } from "./secret";

export const vpc = new sst.aws.Vpc("gbfm_network");

export const cluster = new sst.aws.Cluster("gbfm_cluster", {
	vpc,
});

export const database = new sst.aws.Postgres("gbfm_postgres", {
	vpc,
	dev: {
		username: "user-name",
		password: "strong-password",
		database: "postgres",
		port: 5432,
	},
});

new sst.x.DevCommand("Studio", {
	link: [database, email],
	dev: {
		command: "npx drizzle-kit studio",
		directory: "./vps",
	},
});

export const service = new sst.aws.Service("gbfm_vps", {
	cluster,
	serviceRegistry: {
		port: 3003,
	},
	// loadBalancer: {
	// 	rules: [
	// 		{ listen: "80/http", redirect: "443/https" },
	// 		{ listen: "443/https", forward: "3000/http" },
	// 	],
	// 	domain: {
	// 		name: `vps.${domain}`,
	// 		dns: sst.cloudflare.dns(),
	// 	},
	// },
	dev: {
		directory: "./vps",
		command: "bun dev",
	},
	image: {
		context: "./",
		target: "release",
		dockerfile: "vps/Dockerfile",
	},
	link: [database, email, urls, ...allSecrets],
});

export const vps_gateway = new sst.aws.ApiGatewayV2("gbfm_vps_gateway", {
	vpc,
	domain: {
		name: `vps.${domain}`,
		dns: sst.cloudflare.dns(),
	},
});

const isLocal = ["local", "dev"].includes($app.stage);

if (!isLocal) {
	vps_gateway.routePrivate("$default", service.nodes.cloudmapService.arn);
}

export const outputs = {
	vps_gateway: vps_gateway.url,
};
