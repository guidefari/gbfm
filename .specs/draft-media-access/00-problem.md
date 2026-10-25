# Private draft media delivery

## Summary

Protect unpublished audio and artwork bytes, not only their content pages. Keep public media accessible through stable CDN URLs and keep large audio delivery in the CDN Worker/R2 path. This records the pre-change evidence for [#203](https://github.com/guidefari/gbfm/issues/203). The accepted implementation and its historical-object limits are in [the shape](01-shape.md).

## Baseline before this change

- `apps/server/src/http/upload.handlers.ts` authenticates upload requests and returns presigned PUT/part URLs. Image presigning and audio completion also return a stable `/user-content/<key>` read URL.
- `apps/cdn-router/src/route.ts` maps `/user-content/` and `/mixes/` paths to R2 buckets. `apps/cdn-router/src/index.ts` serves GET/HEAD requests, conditional reads, ranges and optional image transformations without checking viewer identity, draft state or a read signature.
- A disposable fixture against that real handler returned private fixture bytes for an anonymous known-key GET, including a request with an invalid signature and expired timestamp. Anonymous HEAD returned 200; a missing object returned 404. This establishes a handler gap, not verified exposure of a particular production draft. No production draft or account-level edge policy was inspected.
- Content records store media URLs. Audio has its own URL and may inherit its show's artwork; content can therefore share assets rather than own unique bytes. See `apps/server/src/services/audio.service.ts`.
- Audio reads already distinguish public content from drafts readable by assigned creators/admins. `apps/server/src/lib/authorization.ts` provides creator/admin checks for modifications. Resource-specific read policy must not be replaced blindly with a modification check.
- `upload_assets` tracks pending/uploaded/attached/expired lifecycle states. Its service explicitly makes writes best-effort, tolerates missing historical rows and records a single attachment pointer. It does not currently provide authoritative read permissions or a complete shared-reference inventory. See `apps/server/src/services/upload-asset.service.ts` and `apps/server/src/db/upload-asset.schema.ts`.
- `alchemy/cdn.ts` gives the CDN Worker R2 and Images bindings, but no current content-authorization or database binding. `alchemy/storage.ts` configures direct browser PUT access to the upload bucket.

## Problem

Knowing an object key is sufficient for the current CDN handler to return its bytes. Authenticating upload creation or hiding draft pages does not authorize later reads. Issuing signed read URLs does not solve this if an unsigned route still serves the same object.

Privacy belongs to assets and their authorized uses, not merely to the page currently displaying them. A draft's use of an already-public image cannot make that image secret. Conversely, an unattached private upload must not become public just because no content record references it yet.

## Users / callers

- Creators previewing uploaded media before saving or publishing content.
- Assigned creators/admins previewing draft content.
- Anonymous listeners and readers of published content, including external players using public audio URLs.
- Browser image requests, image transformation URLs, audio GET/HEAD/Range requests and conditional requests.
- Content-save and publication operations that change which media may be publicly read.

## Goals

- A known private object key alone cannot retrieve private bytes through any supported CDN route or transformed variant.
- Authorized creators can preview unfinished uploads and draft media without manually managing URLs.
- Draft audio remains playable and seekable during a long preview; expiring access must not silently break later range requests.
- Public media keeps stable, usable URLs, including when a draft references the same public asset.
- One authoritative policy governs byte access; bookkeeping failures and missing records cannot accidentally grant public access.
- Access-control failures fail closed. Authorization happens before any cached private response or conditional response is returned.

## Non-goals

- Named preview grants, tracked separately in #202.
- DRM, preventing an authorized viewer from downloading bytes, or recalling bytes already downloaded/publicly distributed.
- Changing Spotify/external-provider media access or importing externally hosted images into private storage.
- A generic media management framework, background cleanup system or redesign of content publishing.
- Moving production objects, changing production edge policies or deploying without separate authorization. Implementation through an open PR was subsequently approved.

## Constraints

- Use the current Alchemy-managed Workers/R2/Images architecture, not the obsolete CloudFront plan.
- Do not proxy large audio through the WWW/API Worker just to authenticate each byte.
- Preserve legitimate public delivery; do not assume all historical `/user-content/` objects are drafts, or that all `/mixes/` objects are public.
- Never persist expiring credentials as canonical content URLs, or expose signed access tokens in logs/telemetry.
- Keep raw platform bindings at runtime composition boundaries and enforce policy in the owning service/domain boundary.
- No production inventory or edge-policy evidence is available yet. Do not claim live isolation or a safe treatment for every historical object from this source audit.

## Invariants

- Public visibility must be established explicitly, not inferred from a missing asset record or a random-looking object key.
- A private asset requires a valid authorized read. Alternate unsigned paths, HEAD/Range/conditional requests, image transforms and cache keys cannot bypass it.
- Shared public media remains public even when referenced by a draft; withdrawing a content page alone cannot promise secrecy for bytes still used publicly elsewhere.
- Upload write authorization and media read authorization are distinct capabilities.
- An expiring read grant, if selected, is a bearer credential: anyone holding it can use it within its scope and validity window.
- Already delivered bytes cannot be revoked. Any guarantee about unpublishing must state what happens to new requests, outstanding grants and cached public responses separately.

## Confirmed decision

The user approved five-minute bearer preview access, then stable private URLs with renewable signed cookies to avoid reloading audio during renewal. A copied grant can be used during its validity window; media reads do not also require the holder's signed-in session. Public/private object separation replaces the earlier per-read D1 proposal. See [the accepted shape](01-shape.md).

## Open questions

1. How should historical shared assets and objects without recorded ownership/public use be classified? A read-only inventory is required before any migration proposal.
2. What actual CDN caching/edge rules and independent R2 read endpoints exist in production? They must be inspected before claiming every route to new private bytes is protected.
3. Which same-site HTTPS routing should nonproduction stages use? Unrelated preview portals cannot establish SameSite=Strict media access.

Public copies deliberately remain public after unpublishing. Removing creator membership prevents preview renewal; existing grants run to expiry. The historical-object and edge-inventory questions remain open, so this implementation must not auto-close #203.
