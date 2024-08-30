export const www = new sst.aws.StaticSite("gbfm-web", {
	path: "./packages/www",
	// dev: {
	// 	autostart: true,
	// },
});

export const outputs = {
	www: www.url,
};
