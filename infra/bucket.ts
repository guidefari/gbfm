import { domain } from "./dns";

export const bucket = new sst.aws.Bucket("MDX_Bucket", {
  public: true,
});

export const contentBucket = new sst.aws.Bucket("User_Content", {
  access: "cloudfront",
});

export const mixesBucket = new sst.aws.Bucket("Mixes", {
  access: "cloudfront",
});

export const fileRouter = new sst.aws.Router("BucketRouter", {
  domain: {
    name: `bucket.${domain}`,
    dns: sst.cloudflare.dns(),
  },
});

fileRouter.routeBucket("/mdx", bucket);
fileRouter.routeBucket("/user-content", contentBucket);
fileRouter.routeBucket("/mixes", mixesBucket);

export const outputs = {
  // bucket: bucket.domain,
  // contentBucket: contentBucket.domain,
  // mixesBucket: mixesBucket.domain,
  fileRouter: fileRouter.url,
};
