# GBFM image architecture

## Overview

GBFM stores original user artwork in R2 and exposes it through `cdn.goosebumps.fm`. The CDN Worker owns byte delivery and optional transformation. The web app owns responsive selection and presentation. Database records continue to store canonical original URLs.

```text
upload -> original R2 object -> canonical CDN URL in data
                                  |
                                  v
web Artwork/srcset -> CDN query options -> Cloudflare Images binding -> cached variant
                                              |
                                              +-> original R2 bytes on failure
```

Alchemy attaches `Cloudflare.Images.Images('IMAGES')` to the existing CDN Worker. This is a Worker binding, not a second image store. The Worker feeds the R2 body directly into the binding, applies a bounded `scale-down` transform, and returns the requested format and quality.

## History and source

This architecture followed the responsive image work in `~/source/oss/abstract_rhythm`:

- `apps/web/src/components/CatalogImage.tsx` supplied multiple widths, explicit `sizes`, modern formats, lazy loading, and a placeholder.
- `apps/web/src/services/catalog.service.ts` converted canonical catalog asset paths into transformation URLs.
- `packages/functions/src/services/image-options.ts` parsed a small, validated option vocabulary.
- `packages/functions/src/routes/raw-routes.ts` used Cloudflare image transformations and durable cache headers.

GBFM copied the core ideas, not the implementation wholesale. It retained the existing R2 CDN and shared `Artwork` component, adopted bounded query options and responsive source sets, and used Alchemy's declarative Images binding. GBFM improves the origin path by passing R2 bytes directly to the binding. `abstract_rhythm` transforms by asking the Worker to fetch its own public asset URL, which adds an internal HTTP hop.

The work began after an intermittent Safari first load exposed a missing featured cover. A production Lighthouse run then identified that cover as the LCP element: the browser downloaded an approximately 176 KB, 1156-pixel source for a much smaller rendered slot, the response had no useful browser cache lifetime, and the request was discovered late. The first-load fix made the public route render independently of session discovery and added artwork failure recovery. The image architecture addresses the remaining delivery waste without editing the asset itself.

## Ownership

### Storage and canonical identity

- R2 keeps the original bytes.
- Upload code produces unique object keys and canonical `cdn.goosebumps.fm` URLs.
- Database and API payloads store canonical URLs, not viewport-specific variants.
- Updating bytes requires a new key or URL because image responses may be cached as immutable.

### CDN Worker

- `alchemy/cdn.ts` declares R2 and Images bindings.
- `apps/cdn-router/src/route.ts` maps public prefixes to R2 buckets.
- `apps/cdn-router/src/image-options.ts` validates width, quality, and format.
- `apps/cdn-router/src/index.ts` serves original media semantics or transforms image bodies.
- Original image responses without explicit metadata receive a long browser cache lifetime.
- Transformed variants receive distinct ETags derived from the original object and options.
- A transformation exception returns the untouched original stream.

### Web app

- `apps/www/src/lib/image.ts` adds options only for the trusted GBFM CDN hostname.
- `apps/www/src/components/common/Artwork.tsx` gives shared artwork consumers responsive WebP sources and fallback handling.
- The featured home image has explicit widths, viewport-aware `sizes`, eager loading, and high fetch priority because it is the likely LCP element.
- `packages/ui/src/components/artwork.tsx` remains reusable UI and does not know about Cloudflare or GBFM hostnames.

## Coverage and limits

This is a broad shared-component improvement, not automatic interception of every image. Components using the web app's shared `Artwork` wrapper receive responsive delivery. Raw `<img>` elements, profile avatars, upload previews, third-party artwork, local assets, email images, and player metadata keep their existing behavior until intentionally migrated.

Only GBFM CDN URLs can be transformed. This prevents open-proxy abuse and avoids unexpected changes to third-party cache and authorization behavior. AVIF is supported by the CDN contract, while current shared markup requests WebP for broad Safari compatibility. JPEG remains available for deliberate fallback or compatibility work.

The system does not currently generate blur placeholders, proxy arbitrary remote sources, rewrite stored URLs, or migrate originals into Cloudflare hosted image storage. Add those only after evidence shows enough user value to justify the added requests, state, and operational complexity.

## Failure and rollback behavior

- If the responsive URL builder receives an external or invalid URL, it returns the input unchanged.
- If transformation options are invalid, the Worker follows the original object path rather than executing an unbounded transform.
- If Cloudflare transformation throws, the Worker returns the original R2 bytes.
- If the browser still cannot load artwork, the component clears `srcset` and switches to the default cover.
- Removing `srcset` or transformation parameters restores original CDN delivery without data migration.

## Performance model

Optimize the largest visible artwork first. Select a candidate close to rendered CSS width multiplied by device pixel ratio, keep `sizes` truthful, and avoid upscaling. Long-lived caching improves repeat visits, while `fetchPriority` and eager loading affect initial LCP discovery. These solve different parts of the load and should be measured separately.

Cloudflare transformation usage is billable. Review current pricing and account entitlements before production rollout or when materially increasing the number of widths, formats, or transformed surfaces.
