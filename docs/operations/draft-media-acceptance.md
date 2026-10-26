# Draft-media production acceptance (#203)

## Status: incomplete, 2026-10-26

[#203](https://github.com/planetaryescape/gbfm/issues/203) stays open. This runbook separates source guarantees, synthetic production controls, and outstanding acceptance evidence. No production data, objects, policies, or deployments were changed during this inspection.

Source inspected: `origin/prod` at `2a6c4713473cb8b2f3276c0f67ab81f3c2b5aca5`, fetched from GitHub on 2026-10-26. The [accepted design](../../.specs/draft-media-access/01-shape.md) explicitly leaves historical keys public and retains published copies after unpublishing. Do not treat either behavior as a newly discovered regression or silently reverse it.

## Observed production controls

Requests to `https://cdn.goosebumps.fm`, 2026-10-26 around 11:32 UTC:

| Request | Status | Body bytes | Cache-Control |
| --- | --- | --- | --- |
| Synthetic `/user-content/private/acceptance-control/nonexistent.mp3`, GET and HEAD | 403 | 0 | `private, no-store` |
| Same path, GET with `Range: bytes=0-15` | 403 | 0 | `private, no-store` |
| Synthetic private image with `?w=64&f=webp` | 403 | 0 | `private, no-store` |
| `/mixes/private/acceptance-control/nonexistent.mp3` | 403 | 0 | `private, no-store` |
| Encoded prefix `/user-content/%70rivate/acceptance-control/nonexistent.mp3` | 404 | 0 | `private, no-store` |
| Private path with invalid preview cookie | 403 | 0 | `private, no-store` |
| POST `/preview-session`, allowed frontend Origin, JSON invalid grant | 403 | 0 | `private, no-store` |
| Synthetic nonprivate missing-object control | 404 | 0 | absent |
| Actual public CDN image discovered from the production homepage, Range `bytes=0-15` | 200 | 16 | `public, max-age=31536000, immutable` |

The public image response was `image/jpeg` with no Content-Range header. This proves public bytes remained reachable, **not** correct public range semantics. Do not infer seek support from it.

The private controls use deliberately nonexistent keys. They show deployed rejection behavior, not denial of a known existing draft, existence of an object, authorized playback, expiry, cache isolation after an authorized read, or historical protection. The invalid grant was not an expired, formerly valid grant.

Available Cloudflare observability credentials could not list R2 buckets (403) or D1 databases (401). Workers script listing returned 200 with an empty result; that does not establish which production resources exist or how they are configured. No production app session or object-inventory credential was available. Logs alone cannot establish bucket policy or exercise an authorized read.

## Contracts to preserve

- `apps/server/src/http/upload.handlers.ts` generates private upload keys. Preview issuance requires an authenticated uploader, admin, or creator associated with content referencing the canonical asset. Release artwork uses label-creator membership; an episode's supplied show ID alone gives no artwork authority. Unattached private uploads remain readable by their uploader/admin, not ordinary users.
- `packages/core/src/media-preview.ts` defines five-minute bearer grants for one exact HTTPS CDN origin and canonical private path. `apps/cdn-router/src/preview.ts` exchanges them for host-only, exact-path, HttpOnly, Secure, SameSite=Strict cookies from an approved frontend origin.
- `apps/cdn-router/src/index.ts` checks private access before R2, conditional/range reads, and transforms. Private responses override object/transform caching with `private, no-store`. The alternate `/mixes/private/` route is denied; encoded reserved-prefix aliases are rejected. Historical nonprivate routes do not consult publication state.
- `apps/server/src/services/media-publication.ts` authorizes private attachments, commits content before copying bytes to deterministic public keys, and allows authorized update retries after copy failures. Public copies remain public after unpublishing. Removing all qualifying issuance authority stops grant renewal, not already accepted streams or buffered bytes; outstanding grants run to expiry.
- `alchemy/cdn.ts` binds the two R2 buckets and Images. `alchemy/storage.ts` declares upload PUT CORS, but CORS is not a read-access policy and source declarations do not prove deployed bucket exposure or edge/cache rules.

## Remaining read-only production acceptance

Use an existing, explicitly approved draft and sessions held by authorized testers. Do not create accounts, change membership, publish/unpublish content, mint production signing keys, or upload fixtures under this procedure. Keep credentials, grants, cookies, raw traces, draft identifiers and media URLs out of git, PRs, issues and public artifacts. Report role labels, statuses, byte counts, range bounds, cache headers and pass/fail only.

1. **Inventory access and references.** Obtain scoped R2 list/read, D1 read and Cloudflare configuration-read access. Enumerate deployed bucket bindings, r2.dev/custom domains, S3-compatible endpoints, alternate Workers/hosts, legacy buckets/distributions, CDN route precedence and cache rules. Inspect each actual endpoint with a known private object without signing the request. A denied configuration API request is an evidence gap, not proof that public access is disabled.
2. **Classify historical objects.** Reconcile both complete bucket inventories against all audio, post, show, release, profile and inline-image references, including publication history, current draft/public state and shared references. `upload_assets` is best-effort bookkeeping and cannot be the sole authority. Separate private-only, public-only, shared public/draft, previously published/permanent-public, unattached and unresolved objects. Private-only means no approved public-publication history; uncertain history is unresolved, not private-only. Record counts and keep identifiers in restricted evidence. No-prefix and `/mixes/` objects must not be assumed public or private from their names. Any genuinely private-only historical object still anonymously readable fails acceptance; retained public copies do not.
3. **Exercise actual roles.** Through the normal authenticated API, request a grant for the approved asset as uploader/owner, admin and an already-associated collaborator. Check ordinary-user and anonymous issuance denial. Establish the cookie through the allowed same-site HTTPS frontend; verify exact-path isolation and denied unapproved Origin. Do not substitute a grant signed offline for real issuance authorization.
4. **Read and seek.** With each authorized role, verify HEAD length/type/ETag, full GET and a bounded audio Range GET returning 206 and correct Content-Range/length. Compare range bytes with the corresponding slice of the authorized full read in memory. Seek through the production player, verify renewal without changing its source or position, and confirm requests use browser-managed cookies. Record no private media in screenshots or recordings.
5. **Expiry and cache separation.** Save a legitimate short-lived grant privately, then wait until its expiry. Check invalid, tampered, expired and absent credentials on GET, HEAD, Range, conditional reads, original artwork and transformed artwork. After authorized reads/transforms, repeat anonymously with identical URLs, including warmed variants; no protected bytes or reusable cached responses may escape. Check fallback behavior in disposable tests rather than forcing a production transform outage. Verify public image/audio delivery separately with known published objects.
6. **Publication and revocation.** Repeat publish, failed-copy repair, unpublish, membership removal, renewal denial and five-minute residual-access checks using disposable real-binding fixtures. For membership removal, use a non-uploader, non-admin collaborator whose removed association is their last qualifying reference to the asset. Verify issuance denial after removal, then new CDN-request denial after their last legitimate grant expires. For production acceptance, correlate an existing approved transition with before/after evidence, or obtain separate permission for a production transition drill. Read-only inspection cannot prove a transition happened. Never promise that unpublishing recalls permanent public copies or downloaded bytes.

## Approval boundary and closure

Read-only access and authorized tester sessions are the immediate missing inputs. They do not authorize a migration. If the inventory finds private-only historical objects exposed through public keys, prepare a reviewed per-class plan covering shared references, URL rewrites, cache invalidation, old endpoints, rollback and previously distributed bytes. Ask for explicit approval of the named production writes, object moves or policy changes before executing them. Do not blanket-lock historical keys.

Close #203 only after protected originals and genuinely private-only assets of known existing drafts are denied anonymously on every supported endpoint, authorized production read/seek is evidenced, public delivery (including retained permanent public copies) is preserved, historical/shared objects are classified and safely handled, and the cache/expiry/transition requirements have evidence. Disposable fixture results can support a rollout but cannot replace these production gates.
