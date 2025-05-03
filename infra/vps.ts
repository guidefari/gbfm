// import  from './bucket'

import { domain } from "./dns";

export const vpc = new sst.aws.Vpc("gbfm_network");

export const cluster = new sst.aws.Cluster("gbfm_cluster", {
	vpc,
});

export const service = new sst.aws.Service("gbfm_vps", {
	cluster,
	loadBalancer: {
		rules: [
			{ listen: "80/http", redirect: "443/https" },
			{ listen: "443/https", forward: "3000/http" },
		],
		domain: {
			name: `vps.${domain}`,
			dns: sst.cloudflare.dns(),
		},
	},
	dev: {
		directory: "./vps",
		command: "bun dev",
	},
	image: {
		context: "./vps",
	},
	// link: [bucket, fileRouter, etc],
});

export const outputs = {
	service: service.url,
};
