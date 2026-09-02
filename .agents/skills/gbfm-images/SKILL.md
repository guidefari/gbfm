---
name: gbfm-images
description: Work safely with GBFM artwork delivery, responsive image URLs, the shared Artwork component, R2-backed CDN transformations, caching, fallbacks, and Cloudflare Images. Use when adding, changing, debugging, reviewing, or optimizing images in GBFM, including uploads, cover art, thumbnails, LCP images, srcset and sizes, CDN query options, or image-related performance work.
---

# GBFM images

Preserve original assets and optimize delivery through the existing R2 and CDN path. Read [references/architecture.md](references/architecture.md) before changing the CDN contract, image storage, cache policy, or transformation architecture.

## Start with the image owner

- Use `apps/www/src/components/common/Artwork.tsx` for product artwork in the web app.
- Keep `packages/ui/src/components/artwork.tsx` presentation-only and provider-agnostic.
- Use `apps/www/src/lib/image.ts` to build GBFM CDN transformation URLs and source sets.
- Use `apps/cdn-router/src/image-options.ts` to validate the public transformation contract.
- Use `apps/cdn-router/src/index.ts` to read originals and perform transformations.
- Configure the Images binding only through `alchemy/cdn.ts`.

Search for raw `<img>` elements before claiming a change is site-wide. Shared `Artwork` consumers receive responsive delivery automatically; raw image elements do not.

## Follow the delivery rules

1. Store the original image once. Do not resize or recompress the uploaded asset in place.
2. Keep the stored database URL canonical and free of presentation-specific transformation parameters.
3. Transform only URLs hosted at `cdn.goosebumps.fm`. Leave Spotify, Cover Art Archive, avatars, local paths, object URLs, and other external sources unchanged.
4. Request bounded widths through `w`, quality through `q`, and output format through `f`.
5. Supply accurate `sizes` for responsive layouts. Do not add `srcset` without considering the rendered CSS width.
6. Use eager loading and `fetchPriority='high'` only for the likely LCP image. Keep below-the-fold artwork lazy.
7. Preserve a working fallback. Clear `srcset` before changing a failed image to the fallback URL.
8. Treat immutable caching as valid only for content-addressed or otherwise non-overwritten keys. Change the URL when image bytes change.

## Keep the public contract narrow

- Accept widths from 1 through 2048.
- Accept quality from 1 through 100.
- Accept `avif`, `webp`, and `jpeg` output.
- Use `scale-down` so a request never enlarges a smaller original.
- Reject malformed or unbounded options instead of passing arbitrary input to Cloudflare.
- Do not turn the CDN into a remote image proxy.
- Preserve GET, HEAD, range, conditional request, ETag, metadata, and CORS behavior for untransformed objects.
- Fall back to original R2 bytes if Cloudflare transformation throws.

## Test proportionately

- Run `bun --filter @gbfm/cdn-router test` and its typecheck after changing CDN behavior.
- Add parser tests outside route files for new transformation options.
- Run `bun --filter @gbfm/www test:unit src/lib/image.test.ts` after changing URL generation.
- Cover first-load, request failure, and LCP behavior through Playwright rather than page or route unit tests.
- Run `bun precommit` and `bun --filter @gbfm/www build` before handoff.
- Use Lighthouse against a deployed preview or production only to measure real CDN and cache behavior. Compare transfer size, LCP request timing, responsive-image waste, cache TTL, and whether the image is discoverable and prioritized.

## Review production impact

- Cloudflare Images transformations consume account usage and can affect billing.
- Do not deploy or enable new transformation behavior without confirming account availability and expected cost.
- Keep original URLs valid so rollback can remove responsive parameters without migrating data.
- Avoid changing upload paths, database values, or R2 objects unless the task explicitly requires it.
