export const domain =
	{
		prod: "goosebumps.fm",
		dev: "dev.goosebumps.fm",
	}[$app.stage] || `${$app.stage}.goosebumps.fm`;

export const urls = new sst.Linkable("Urls", {
	properties: {
		//   api: `https://api.${domain}`,
		//   auth: `https://auth.${domain}`,
		//   openapi: `https://api.${domain}/doc`,
		site:
			$app.stage === "dev" ? "http://localhost:5173" : `https://www.${domain}`,
		vps:
			$app.stage === "dev" ? "http://localhost:3003" : `https://vps.${domain}`,
	},
});

// export const shortDomain = domain.replace(/goosebumps\.fm$/, "gbfm.dev");

// export const zone = cloudflare.getZoneOutput({
// 	filter: {
// 		name: domain,
// 	},
// });

// export const shortZone = cloudflare.getZoneOutput({
//   name: "gbfm.dev",
// });
