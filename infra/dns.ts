export const domain =
	{
		production: "goosebumps.fm",
		dev: "dev.goosebumps.fm",
	}[$app.stage] || `${$app.stage}.dev.goosebumps.fm`;

// export const shortDomain = domain.replace(/goosebumps\.fm$/, "gbfm.dev");

export const zone = cloudflare.getZoneOutput({
	name: "goosebumps.fm",
});

// export const shortZone = cloudflare.getZoneOutput({
//   name: "gbfm.dev",
// });
