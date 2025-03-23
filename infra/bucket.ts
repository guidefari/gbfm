export const bucket = new sst.aws.Bucket("MDX_Bucket", {
	public: true,
});

export const contentBucket = new sst.aws.Bucket("User_Content", {
	access: "cloudfront",
});

export const mixesBucket = new sst.aws.Bucket("Mixes", {
	access: "cloudfront",
});

export const outputs = {
	bucket: bucket.domain,
	contentBucket: contentBucket.domain,
	 mixesBucket: mixesBucket.domain,
};
