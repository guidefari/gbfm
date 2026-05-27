export const domain =
  {
    prod: 'goosebumps.fm',
    dev: 'dev.goosebumps.fm'
  }[$app.stage] || `${$app.stage}.goosebumps.fm`

export const urls = new sst.Linkable('Urls', {
  properties: {
    //   api: `https://api.${domain}`,
    //   openapi: `https://api.${domain}/doc`,
    site: $app.stage === 'dev' ? 'http://127.0.0.1:5173' : `https://${domain}`,
    vps:
      $app.stage === 'dev' ? 'http://127.0.0.1:3003' : `https://www.${domain}/api`
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

  const importId = process.env.CF_RULESET_IMPORT || undefined

  // Proxy goosebumps.fm/api/* and www.goosebumps.fm/api/* to the VPS backend,
  // making API calls same-origin from the browser's perspective (no CORS needed).
  const apiProxy = new sst.cloudflare.Worker('ApiProxy', {
    handler: './apps/workers/api-proxy.ts',
    environment: {
      VPS_HOSTNAME: `vps.${domain}`
    }
  })

  new cloudflare.WorkersRoute('ApiProxyApex', {
    zoneId: zone.zoneId,
    pattern: `${domain}/api/*`,
    scriptName: apiProxy.nodes.worker.scriptName
  })

  new cloudflare.WorkersRoute('ApiProxyWww', {
    zoneId: zone.zoneId,
    pattern: `www.${domain}/api/*`,
    scriptName: apiProxy.nodes.worker.scriptName
  })

  new cloudflare.Ruleset(
    'vps-redirects',
    {
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
          expression: `((http.request.uri.path eq "/rss.xml") or (http.request.uri.path eq "/rss")) and (http.host eq "${domain}")`,
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
          expression: `(http.request.uri.path eq "/sitemap.xml") and (http.host eq "${domain}")`,
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
          expression: `starts_with(http.request.uri.path, "/s/") and (http.host eq "${domain}")`,
          description: 'Redirect share routes to VPS OG handlers',
          enabled: true
        }
      ]
    },
    importId ? { import: importId } : undefined
  )
}
