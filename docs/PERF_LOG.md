Public log of load-time work on goosebumps.fm. Numbers are measured against production, not staging or local — cold Lighthouse runs and direct `curl` timing against the live domain.

## Timeline

### Bundle size cut, 45% smaller entry (#139)

Homepage entry bundle cut by 45%. Cold LCP improved from **1.8s to a claimed 1.0s** in that PR's testing.

### Edge caching + lazy dialogs (#141)

A follow-up cold Lighthouse run against production came back at **1.9s LCP** — worse than the 1.0s #139 claimed, so there was more room. Two problems, fixed together, then a third change landed alongside them.

**1. `index.html` wasn't cached at the edge.**

It was served `Cache-Control: max-age=0, no-cache, no-store, must-revalidate` — the framework default for HTML. Every visitor, on every request, paid a full round-trip to origin just to get the HTML shell before the browser could start parsing anything. Measured directly against prod before the fix:

```
run 1 (cold): TTFB 1.33s   x-cache: RefreshHit from cloudfront
run 2 (warm): TTFB 0.06s   x-cache: Hit from cloudfront
run 3 (warm): TTFB 0.06s   x-cache: Hit from cloudfront
```

Lighthouse's `server-response-time` audit independently flagged **829ms** on the root document, with ~729ms of possible savings.

Fix: give HTML a 60-second edge TTL instead of `no-store`. Hashed JS/CSS assets were already correctly set to a 1-year immutable cache — no change needed there.

**2. Two closed-by-default dialogs were loaded eagerly on every route.**

The homepage's `<head>` carried 23 `<link rel="modulepreload">` tags. The browser fetched, parsed, and compiled all 23 chunks at high priority on every route load — home included — even though most of that code belonged to UI that wasn't visible yet.

`__root.tsx` statically imported `AuthPromptDialog` and `WelcomeModal`, both closed by default (`AuthPromptDialog` opens only via a store flag; `WelcomeModal` opens only for signed-in users who haven't seen it, 500ms after mount). Because the router treats anything statically reachable from the root route as always-needed, both components — plus the toast, icon, and auth-client code they pulled in — were forced into the eager preload graph instead of loading on demand.

Fix: lazy-load both behind `React.lazy()` + `Suspense`, the same pattern already used for `QueueColumn` elsewhere in the app. `AuthPromptDialog` now ships as its own 4.88 kB chunk instead of being folded into the main bundle.

**3. Migrated the static site off AWS (S3 + CloudFront) onto Cloudflare Workers.**

DNS for goosebumps.fm already lived on Cloudflare with the proxy on, so CloudFront was a second CDN sitting *behind* the edge that was already terminating traffic — a redundant hop, and a second place cache headers had to be reasoned about. That redundancy is what made problem #1 more complicated than it should have been.

Replaced `sst.aws.StaticSite` with `sst.cloudflare.StaticSiteV2` — SST's current recommended component for a Vite SPA on Cloudflare. This removes the S3 bucket, CloudFront distribution, and ACM certificate entirely; the site now serves directly from a Cloudflare Worker with native static-assets, one hop instead of two.

Cache behavior had to move with it — Cloudflare's static-assets binding defaults every file, including hashed JS/CSS, to `max-age=0, must-revalidate`. Replaced the old cache config with a Cloudflare-native `_headers` file that reproduces the same policy: 1-year immutable for hashed assets and fonts, 60s revalidate for HTML.

One rollout wrinkle: Cloudflare's `_headers` glob for `*.html` matches `/index.html` directly but not the bare root path `/`, even though the site serves `/` by internally rewriting to `index.html`. Root was briefly falling through to the platform default (`max-age=0`) until a follow-up fix added an explicit `/` rule.

## Results

Measured against production after all three changes shipped:

- **TTFB (root):** 1.33s cold / 60ms warm → **~40ms, consistently**
- **Root document server-response-time:** 829ms → **20ms**
- **Root `cache-control`:** `no-store` → `public, max-age=60, must-revalidate`
- **Hosting:** AWS S3 + CloudFront behind Cloudflare → Cloudflare Workers, single hop
- **Lighthouse performance score:** **88-93** across a 3-run range
- **LCP:** 1.9s cold baseline that motivated this work → **~1.7-2.0s**

The TTFB and server-response-time wins are large and consistent — moving off a double-CDN setup with a `no-store` root document onto a single-hop Cloudflare Worker with a 60s edge cache removed almost the entire origin round-trip. LCP improvement is real but noisier across runs and didn't reach the 1.0s figure #139 had claimed; that number likely reflected a single favorable run rather than a stable baseline. Next step, if LCP is worth chasing further, is a proper multi-run trace to find what's actually gating the largest paint now that server latency is no longer the obvious bottleneck.

## Known remaining limits

`FloatingMenu`, rendered on every route via `AppShell`, calls `useSession()` for real nav state — not incidental bloat — and keeps pulling in better-auth client chunks eagerly. Shrinking that further means swapping to a lighter session-check-only client path, a separate and bigger effort than this round.
