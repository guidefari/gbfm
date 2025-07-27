export const domain =
	{
		prod: "goosebumps.fm",
		dev: "dev.goosebumps.fm",
	}[$app.stage] || `${$app.stage}.goosebumps.fm`;

export const urls = new sst.Linkable("Urls", {
	properties: {
		//   api: `https://api.${domain}`,
		//   openapi: `https://api.${domain}/doc`,
		site:
			$app.stage === "dev" ? "http://localhost:5173" : `https://www.${domain}`,
		vps:
			$app.stage === "dev" ? "http://localhost:3003" : `https://vps.${domain}`,
	},
});


// RSS redirect rule for production
if ($app.stage === "prod") {
	const zone = cloudflare.getZoneOutput({
		filter: {
			name: domain,
		},
	});

	new cloudflare.Ruleset("rss-redirect", {
		kind: "zone",
		zoneId: zone.zoneId,
		name: "RSS Feed Redirects",
		description: "Redirect RSS requests to VPS",
		phase: "http_request_dynamic_redirect",
		rules: [
			{
				action: "redirect",
				actionParameters: {
					fromValue: {
						statusCode: 301,
						targetUrl: {
							value: `https://vps.${domain}/rss.xml`,
						},
					},
				},
				expression: `(http.request.uri.path eq "/rss.xml") or (http.request.uri.path eq "/rss")`,
				description: "Redirect RSS feeds to VPS",
				enabled: true,
			},
		],
	});
}

// export const shortDomain = domain.replace(/goosebumps\.fm$/, "gbfm.dev");

// export const zone = cloudflare.getZoneOutput({
// 	filter: {
// 		name: domain,
// 	},
// });

// export const shortZone = cloudflare.getZoneOutput({
//   name: "gbfm.dev",
// });
