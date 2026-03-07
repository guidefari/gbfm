export const domain =
  {
    prod: 'goosebumps.fm',
    dev: 'dev.goosebumps.fm'
  }[$app.stage] || `${$app.stage}.goosebumps.fm`

export const urls = new sst.Linkable('Urls', {
  properties: {
    //   api: `https://api.${domain}`,
    //   openapi: `https://api.${domain}/doc`,
    site: $app.stage === 'dev' ? 'http://localhost:5173' : `https://${domain}`,
    vps:
      $app.stage === 'dev' ? 'http://localhost:3003' : `https://vps.${domain}`
  }
})

// Cloudflare redirect rules — see docs/architecture/cloudflare-redirects.md
// RSS redirect rule for production
if ($app.stage === 'prod') {
  const zone = cloudflare.getZoneOutput({
    filter: {
      name: domain
    }
  })

  new cloudflare.Ruleset('vps-redirects', {
    kind: 'zone',
    zoneId: zone.zoneId,
    name: 'VPS Route Redirects',
    description: 'Redirect requests to VPS for dynamic content',
    phase: 'http_request_dynamic_redirect',
    rules: [
      {
        action: 'redirect',
        actionParameters: {
          fromValue: {
            statusCode: 301,
            targetUrl: {
              value: `https://vps.${domain}/rss.xml`
            }
          }
        },
        expression: `(http.request.uri.path eq "/rss.xml") or (http.request.uri.path eq "/rss")`,
        description: 'Redirect RSS feeds to VPS',
        enabled: true
      },
      {
        action: 'redirect',
        actionParameters: {
          fromValue: {
            statusCode: 301,
            targetUrl: {
              value: `https://vps.${domain}/sitemap.xml`
            }
          }
        },
        expression: `http.request.uri.path eq "/sitemap.xml"`,
        description: 'Redirect sitemap to VPS dynamic sitemap',
        enabled: true
      },
      {
        action: 'redirect',
        actionParameters: {
          fromValue: {
            statusCode: 301,
            targetUrl: {
              expression: `concat("https://vps.${domain}", http.request.uri.path)`
            },
            preserveQueryString: true
          }
        },
        expression: `starts_with(http.request.uri.path, "/s/")`,
        description: 'Redirect share routes to VPS OG handlers',
        enabled: true
      }
    ]
  })
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
