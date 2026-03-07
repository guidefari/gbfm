# Cloudflare Redirect Rules

Defined in `infra/dns.ts`, applied via the Cloudflare Ruleset API at the zone level (production only).

## Why these exist

The frontend (`goosebumps.fm`) is a client-side SPA served from Cloudflare/AWS. It has no server to dynamically generate RSS feeds, sitemaps, or OG meta tags. These redirect rules transparently route specific paths to the VPS (`vps.goosebumps.fm`), which handles all dynamic/server-rendered responses.

## Rules

### RSS feeds
```
(http.request.uri.path eq "/rss.xml") or (http.request.uri.path eq "/rss")
→ 301 https://vps.goosebumps.fm/rss.xml
```
RSS cannot be generated statically. The VPS queries the database and returns a live feed.

### Sitemap
```
http.request.uri.path eq "/sitemap.xml"
→ 301 https://vps.goosebumps.fm/sitemap.xml
```
The sitemap is dynamic — it includes all mixes, shows, releases, labels, profiles, and posts from the database. A static sitemap would go stale immediately.

### Share / OG routes (`/s/*`)
```
starts_with(http.request.uri.path, "/s/")
→ 301 concat("https://vps.goosebumps.fm", http.request.uri.path)
```
Social crawlers (Slack, Twitter, iMessage, etc.) don't execute JavaScript, so they can't read OG meta tags from the SPA. The `/s/` routes are handled by the VPS, which returns server-rendered HTML with full OG tags, Twitter cards, and JSON-LD structured data, then immediately redirects the user to the real SPA page via `<meta http-equiv="refresh">`.

See `apps/vps/src/routes/redirect/redirect.template.ts` for the HTML template and `apps/vps/src/routes/redirect/handlers/` for per-content-type handlers.

## Phase

All rules run in `http_request_dynamic_redirect` phase, which fires before Cloudflare serves cached assets — ensuring crawlers and users always hit the VPS for these paths rather than the SPA's static files.

## Troubleshooting: deployment error 20217

**Symptom**: Deployment fails with:
```
'zone' is not a valid value for kind because exceeded maximum number of zone rulesets
for phase http_request_dynamic_redirect (code 20217)
```

**Cause**: Cloudflare only allows one zone-level ruleset per phase. If SST/Pulumi state gets out of sync with Cloudflare (e.g. after a partial deployment failure or a state reset), the next deploy tries to `POST` (create) a new ruleset even though one already exists in Cloudflare.

**Fix**:

1. Delete the orphaned Cloudflare ruleset using the helper script:
   ```bash
   CLOUDFLARE_API_TOKEN=<token> ./scripts/fix-cf-redirect-ruleset.sh
   ```
   The API token needs **Zone > Rulesets > Edit** permission. The zone ID is hardcoded in the script (`75566badee03001f5a62414d8c32901d`).

2. Redeploy:
   ```bash
   bun deploy:prod
   ```

SST will recreate the ruleset and properly track it in its Pulumi state going forward.
