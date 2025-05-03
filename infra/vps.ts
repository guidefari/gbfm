// import  from './bucket'

import { domain } from "./dns";

export const vpc = new sst.aws.Vpc("gbfm_network");

export const cluster = new sst.aws.Cluster("gbfm_cluster", {
	vpc,
});

export const service = new sst.aws.Service("gbfm_vps", {
	cluster,
	serviceRegistry: {
		port: 3000,
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
		context: "./vps",
	},
	// link: [bucket, fileRouter, etc],
});

const apiGateway = new sst.aws.ApiGatewayV2("gbfm_vps_gateway", {
	vpc,
	domain: {
		name: `vps.${domain}`,
		dns: sst.cloudflare.dns(),
	},
});

apiGateway.routePrivate("$default", service.nodes.cloudmapService.arn);

export const outputs = {
	service: service.url,
};
