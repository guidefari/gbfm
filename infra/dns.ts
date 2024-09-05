export const domain =
	{
		prod: "goosebumps.fm",
		staging: "staging.goosebumps.fm",
	}[$app.stage] || `${$app.stage}.staging.goosebumps.fm`;

// export const shortDomain = domain.replace(/goosebumps\.fm$/, "gbfm.dev");

export const zone = cloudflare.getZoneOutput({
	name: "goosebumps.fm",
});

// export const shortZone = cloudflare.getZoneOutput({
//   name: "gbfm.dev",
// });
