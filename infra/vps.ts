// import  from './bucket'

export const vpc = new sst.aws.Vpc("gbfm_serverful", {
	az: ["af-south-1a", "eu-west-1a"]
});

export const cluster = new sst.aws.Cluster("gbfm_serverful", {
	vpc,
});

export const service = new sst.aws.Service("gbfm_serverful", {
	cluster,
	loadBalancer: {
		ports: [{ listen: "80/http", forward: "3000/http" }],
	},
	dev: {
		command: "bun dev",
	},
	// link: [bucket, fileRouter, etc],
});

