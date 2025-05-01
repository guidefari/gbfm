/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "gbfm-server",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const vpc = new sst.aws.Vpc("gbfmserver");
    const bucket = new sst.aws.Bucket("gbfmserver");

    const cluster = new sst.aws.Cluster("gbfmserver", { vpc });
    new sst.aws.Service("gbfmserver", {
      cluster,
      loadBalancer: {
        ports: [{ listen: "80/http", forward: "3000/http" }],
      },
      dev: {
        command: "bun dev",
      },
      link: [bucket],
    });
  },
});
