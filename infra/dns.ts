export const domain =
	{
		prod: "goosebumps.fm",
		dev: "dev.goosebumps.fm",
	}[$app.stage] || `${$app.stage}.goosebumps.fm`;

// export const shortDomain = domain.replace(/goosebumps\.fm$/, "gbfm.dev");

// export const zone = cloudflare.getZoneOutput({
// 	filter: {
// 		name: domain,
// 	},
// });

// export const shortZone = cloudflare.getZoneOutput({
//   name: "gbfm.dev",
// });
