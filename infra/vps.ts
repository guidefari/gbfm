// import  from './bucket'

import { domain } from "./dns";

export const vpc = new sst.aws.Vpc("gbfm_network");

export const cluster = new sst.aws.Cluster("gbfm_cluster", {
	vpc,
});

export const service = new sst.aws.Service("gbfm_vps", {
	cluster,
	loadBalancer: {
		ports: [{ listen: "80/http", forward: "3000/http" }],
		domain: {
			name: `vps.${domain}`,
			dns: sst.cloudflare.dns(),
		},
	},
	dev: {
		command: "bun dev",
	},
	image: {
		context: "../vps",
		dockerfile: "Dockerfile"
	},
	// link: [bucket, fileRouter, etc],
});

export const outputs = {
	service: service.url,
};