# Shape: Private uploads with renewable preview cookies

## Decision

Use stable private URLs and five-minute signed cookies. This supersedes the earlier proposal for signed URLs and a D1 public-reference lookup on every CDN request. The user rejected source replacement during long audio playback and approved this simpler read path.

Public delivery remains an ordinary CDN/R2 read. Private delivery verifies a signature and expiry locally. Neither path queries D1, a session service, or a lease store.

## Storage and publication

- New uploads use `private/<sanitized uploader id>/...` keys in USER_CONTENT. The uploader is encoded by the authenticated upload API, not chosen by the caller. Multipart and image keys include unique IDs.
- The canonical private locator is `/user-content/private/<key suffix>`. Knowing this URL is not permission to read it.
- Draft saves validate attachment authority but never copy private bytes to a public key. A creator cannot attach another uploader's private asset merely by knowing its URL. Existing authorized resource associations allow collaborators to keep using an asset.
- Publishing prepares canonical `public/<key suffix>` URLs, commits the content/creator/label writes, then copies the corresponding original objects server-side. Inline Markdown images are parsed and rewritten; prose, ordinary links, code and unsupported HTML are not interpreted as image attachments.
- Copies happen only after content writes succeed. A failed copy fails the request; the committed URL may temporarily be unavailable. Deterministic source/target keys let a subsequent authorized save repair the copy. This is not a cross-service transaction.
- Public profiles are explicit publication surfaces too. Their private avatar uploads become public copies when saved.
- Public copies are permanent. Returning a page to draft does **not** make already-published bytes secret or delete the public object.
- The existing `upload_assets` lifecycle remains informational cleanup bookkeeping, not the read-authorization boundary.

## Preview flow

```text
Browser ── POST /api/upload/preview {url} ──> API
   │                                          │
   │                               session + uploader / assigned creator / admin
   │                                          │
   │<──────────── {sessionUrl, grant, expiresAt}
   │
   ├── credentialed POST /preview-session {grant} ──> CDN
   │<── HttpOnly Secure exact-path cookie
   │
   └── credentialed GET / HEAD / Range ────────────> CDN ──> R2
                                                    │
                                            local HMAC + expiry
                                            no database lookup
```

The API checks current authorization each time it issues access. Grants contain one canonical asset path, the exact HTTPS CDN origin and an integer expiry no more than five minutes away. They are bearer credentials, not identity tokens.

The CDN exchanges a valid grant from an allowed frontend origin for a host-only `__Secure-gbfm-preview` cookie: HttpOnly, Secure, SameSite=Strict, scoped to the exact media path. Several assets can have independently scoped cookies. Credentialed CORS reflects only configured exact origins; public wildcard CORS is unchanged.

Authorization precedes R2 access, HEAD/range/conditional handling and image transformation. Private successes, errors, transformations and fallback responses use `private, no-store`. `/mixes/private/` and encoded reserved-prefix aliases cannot bypass the user-content boundary. Missing signing configuration fails private requests closed without breaking public reads.

## Browser lifecycle

- Establish a cookie before loading private audio or images. Private audio sets `crossOrigin='use-credentials'` before its source.
- Renew active preview access at approximately two minutes, and recheck on visibility/online return. Coalesce concurrent requests and throttle resume events.
- Renewal changes the cookie, **not** `audio.src`, the selected track, playback position or play/pause intent.
- Denial pauses private audio and reports an error without an automatic retry loop. Disposal aborts requests and clears listeners/timers.
- Persist only canonical queue URLs. Grants never enter the saved queue or media URL query string.

Expiry stops newly accepted reads; it cannot recall buffered bytes or terminate an already accepted stream. Permission removal prevents renewal, but an outstanding cookie remains valid until expiry. Background browser suspension can outlast a cookie, so arbitrary network interruptions and suspended-tab recovery are not a promise of gapless playback.

## Alchemy and environments

Alchemy creates one stage-scoped random signing key and binds it to the API and CDN. The key is independent of R2 upload credentials. Production allows the two same-site frontend origins, `https://goosebumps.fm` and `https://www.goosebumps.fm`.

Secure same-site frontend/CDN routing is required. A cross-site orb portal or arbitrary workers.dev frontend cannot rely on a SameSite=Strict media cookie. Plain HTTP development cannot prove this contract. Browser validation uses disposable same-site HTTPS fixture hosts, the real API, local D1 and a real Workers/R2 runtime; it does not change production data.

## Rollout limits

This implementation protects the **new reserved private namespace**. Historical keys keep their existing public behavior: there is no blanket lock, production move, backfill or cache purge in this change. It does not close #203's existing-object exposure.

Before production rollout, confirm independent bucket read endpoints and CDN/cache rules cannot expose new private keys. Existing objects require a separate read-only inventory and an approved migration plan. Already distributed public bytes cannot be recalled. Nonproduction same-site domains and origin configuration must be set up before private previews can work there.

Costs are local signature verification on private reads, authenticated API/D1 checks on issuance/renewal, and one retained public copy per published private object. Public reads gain no database cost. Private media deliberately loses shared/browser caching. No numeric cost estimate is claimed without usage data.
