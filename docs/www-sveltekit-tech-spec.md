# `apps/www` SvelteKit on Cloudflare: technical specification

Status: accepted for implementation

## Summary

Rewrite `apps/www` as one SvelteKit v3 application and deploy it as a Cloudflare Worker with `Cloudflare.Website.SvelteKit`. This is a big-bang replacement: no Astro, Railway, React islands, compatibility shell, or mixed router. The replacement preserves every current URL and product capability, uses the existing API and social-image Workers through Cloudflare service bindings, and replaces frontend Sentry with Cloudflare Workers Observability plus a first-party browser telemetry endpoint backed by Analytics Engine.

The cutover is gated by route-manifest parity, workflow E2E tests, SSR/SEO assertions, workerd binding tests, visual verification, performance budgets, and `bun precommit`.

## Context / current state

`apps/www` is a React 19 SPA with TanStack Router and React Query. Cloudflare currently serves static assets from `Cloudflare.Website.StaticSite`; `seo-worker.ts` intercepts HTML to inject metadata and forwards selected paths through `API` and `SOCIAL_IMAGES` service bindings.

The app contains four distinct workloads:

1. indexable public content (mixes, shows, tweets, editorial, music entities, profiles);
2. a persistent interactive shell (navigation, audio player, queue, theme, search);
3. authenticated creation and upload workflows;
4. a role-gated operational dashboard.

Observed tweets/shows navigations can be slow. Current browser telemetry is primarily Sentry-based and does not cleanly separate router, API, rendering, and media work.

## Goals

- Replace all React/TanStack UI and routing with Svelte 5/SvelteKit v3.
- Preserve all public URLs, redirects, capabilities, responsive states, and role rules.
- Render indexable content and metadata during SSR.
- Keep the player and queue alive across client-side navigation.
- Keep Worker-to-Worker traffic on Cloudflare service bindings.
- Make browser and server navigation latency diagnosable without Sentry.
- Add automated direct-load and client-navigation smoke coverage for every URL pattern, plus focused E2E coverage for consequential workflows.
- Keep TypeScript at the repository version; pin SvelteKit v3 prerelease dependencies exactly.
- Open a replacement PR only after verification is green and visual states are inspected.

## Non-goals

- Visual redesign or product-scope changes.
- Incremental route rollout, hybrid rendering, React islands, or retaining the old SPA at runtime.
- Moving the API, database, R2, Durable Objects, email, or social-image Worker.
- Replacing the existing framework-neutral player domain package or upload protocol.
- Removing backend Sentry in this frontend rewrite. This spec removes Sentry from `apps/www`; backend observability can be migrated separately.
- A new offline/PWA feature. The existing “offline” behavior is only connection-status UI.

## Invariants

1. `API` and `SOCIAL_IMAGES` bindings are only read at the Cloudflare/SvelteKit composition seam.
2. Browser API/auth traffic is same-origin; no browser bundle receives an internal binding or secret.
3. Unknown API/session/telemetry payloads are parsed with Effect Schema before application code receives them.
4. Protected data is guarded in a server hook or route-specific `+page.server.ts`/action. A parent layout guard alone is insufficient.
5. The root Svelte layout owns exactly one player runtime for the browser lifetime; navigation does not recreate it.
6. Public content, canonical metadata, and JSON-LD are present in the initial HTML response.
7. Telemetry never contains request bodies, cookies, tokens, email addresses, raw user content, media URLs with signatures, or arbitrary serialized exceptions.
8. Every current route has a SvelteKit route, an explicit redirect, or an intentional 404 before cutover.
9. Existing framework-neutral TypeScript behavior remains behind its current public contracts where those contracts are not React-specific.

## Design constraints

- Alchemy `2.0.0-beta.79` expects `@alchemy.run/frontend-frameworks` and the SvelteKit v3 Vite API. There is no `svelte.config.js`, Wrangler file, or checked-in Cloudflare adapter.
- The app remains on Cloudflare and retains `www.goosebumps.fm` plus the apex alias.
- The API's Better Auth session cookie is currently issued by API-host requests. The new browser contract uses same-origin `/auth/*` proxy routes, so a newly issued cookie belongs to the frontend host and is visible during SSR.
- Existing API-host-only sessions cannot be copied by JavaScript because they are `HttpOnly`. Unless cross-subdomain cookie issuance is deliberately enabled before cutover, users will perform a one-time sign-in after deployment. This is a cutover decision, not something the implementation should hide.
- `@overengineering/fps-meter` is React-only. The old package cannot remain without retaining React; development FPS diagnostics will be reimplemented as a small Svelte component with equivalent visible behavior.

## Alternatives considered

### Option 1: SvelteKit SSR Worker with direct service bindings — recommended

```text
Browser -> SvelteKit Worker -> API/SocialImage service bindings
```

- SSR, actions, endpoints, and client navigation share one route model.
- No public HTTP hop between owned Workers.
- Same-origin browser auth/API surface.
- Native Cloudflare request logs/traces and Analytics Engine browser events.
- Requires the full rewrite and careful cookie cutover.

### Option 2: Static SvelteKit SPA on Cloudflare

```text
Browser -> static assets -> public API hostname
```

- Lowest runtime change, but recreates the current architecture.
- Does not solve crawler-specific SEO, SSR auth, or first-response content.
- Keeps cross-origin cookie/CORS complexity and makes navigation timing harder to decompose.

Rejected because it forfeits the main reasons to adopt SvelteKit.

### Option 3: SvelteKit SSR Worker calling the public API URL

```text
Browser -> SvelteKit Worker -> public Cloudflare API hostname
```

- Works without a binding contract.
- Adds an avoidable network/TLS hop, weaker local parity, CORS/cookie duplication, and less reliable trace correlation.

Rejected because this repository already owns and deploys both Workers with a service binding.

## Recommendation

Use Option 1. Treat SvelteKit as the HTTP/UI External Adapter Module, keep reusable domain code framework-neutral, and expose two narrow platform adapters:

- `ApiGateway`: typed same-origin browser forwarding and direct server-side service-binding calls;
- `BrowserTelemetry`: parsed first-party event ingestion into Analytics Engine and structured Worker logs.

## Proposed design

### Runtime topology

```diagram
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTML, Svelte data, forms, /api/*, /auth/*, telemetry
       ▼
┌──────────────────────────────────────────────────────────────┐
│ Cloudflare SvelteKit Worker                                  │
│ ┌────────────┐ ┌──────────────┐ ┌─────────────┐             │
│ │ SSR/routes │ │ Root player  │ │ Telemetry   │             │
│ │ and actions│ │ + app shell  │ │ ingestion   │             │
│ └─────┬──────┘ └──────────────┘ └──────┬──────┘             │
│       │ API binding                     │ Analytics Engine    │
└───────┼─────────────────────────────────┼─────────────────────┘
        ▼                                 ▼
┌──────────────┐                  ┌────────────────┐
│ API Worker   │                  │ Browser events │
│ D1/R2/DO/etc │                  │ dataset        │
└──────────────┘                  └────────────────┘
        ▲
        │ SOCIAL_IMAGES binding is separate for social card paths
┌───────┴────────────┐
│ SocialImage Worker│
└────────────────────┘
```

### Route groups

| SvelteKit group | URLs | Rendering / guard |
| --- | --- | --- |
| `(public)` | `/`, `/$slug`, `/mixes`, `/mixes/[mixId]`, `/shows`, `/shows/[showSlug]`, `/tweets`, `/tweet`, `/tweet/[slug]`, `/tweet/latest`, `/editorial`, `/editorial/[slug]`, `/tracks/[trackId]`, `/releases/[slug]`, `/labels`, `/labels/[labelSlug]`, `/tags`, `/tags/[tag]`, `/djs`, `/profile/[username]`, `/changelog`, `/privacy`, `/terms` | SSR server loads; indexable metadata |
| `(account)` | `/auth/*`, `/subscribe`, `/unsubscribe`, `/invite/charlie3000`, `/spotify/callback` | actions/endpoints; anonymous or callback-specific |
| `(member)` | `/reminders`, `/dashboard`, personal dashboard routes | authenticated server guard |
| `(creator)` | `/new`, `/new/tweet`, `/new/editorial`, `/mix-upload` | authenticated role guard; client-heavy editors/uploads |
| `(admin)` | admin/content/music/users/sessions/shows/newsletter/email-log/error diagnostic dashboard routes | admin server guard on every protected load/action |
| gateway | `/api/[...path]`, `/auth/[...path]`, `/health`, `/rss.xml`, `/sitemap.xml`, `/s/[...path]`, social-card paths | binding forwarding; no UI rendering |

Route groups organize policy without changing URLs. Exact routes win over catch-all auth/API gateway routes.

## Domain model and types

```ts
type Role = 'user' | 'creator' | 'editor' | 'admin'

type AnonymousPrincipal = { readonly _tag: 'Anonymous' }
type AuthenticatedPrincipal = {
  readonly _tag: 'Authenticated'
  readonly userId: UserId
  readonly name: string
  readonly role: Role
  readonly imageUrl?: string
  readonly emailVerified: boolean
}
type Principal = AnonymousPrincipal | AuthenticatedPrincipal

type RouteAccess =
  | { readonly _tag: 'Public' }
  | { readonly _tag: 'Authenticated' }
  | { readonly _tag: 'Creator' }
  | { readonly _tag: 'Admin' }

type PlayerState =
  | { readonly _tag: 'Idle'; readonly queue: ReadonlyArray<QueueItem> }
  | { readonly _tag: 'Loading'; readonly item: QueueItem; readonly queue: ReadonlyArray<QueueItem> }
  | { readonly _tag: 'Playing'; readonly item: QueueItem; readonly queue: ReadonlyArray<QueueItem> }
  | { readonly _tag: 'Paused'; readonly item: QueueItem; readonly queue: ReadonlyArray<QueueItem> }
  | { readonly _tag: 'Failed'; readonly item: QueueItem; readonly error: PlaybackFailure }

type BrowserTelemetryEvent =
  | NavigationTelemetry
  | WebVitalTelemetry
  | ApiFailureTelemetry
  | UiDefectTelemetry
  | PlayerTelemetry
```

Existing API schemas remain the canonical protocol contracts. SvelteKit server adapters decode unknown responses into those schema types; pages receive serializable projections only.

## Types, interfaces, and APIs

### Cloudflare platform composition

```ts
type WebsiteBindings = {
  readonly API: Fetcher
  readonly SOCIAL_IMAGES: Fetcher
  readonly BROWSER_TELEMETRY: AnalyticsEngineDataset
  readonly APP_STAGE: string
  readonly SPOTIFY_CLIENT_ID: string
}

declare global {
  namespace App {
    interface Platform { readonly env: WebsiteBindings }
    interface Locals {
      readonly principal: Principal
      readonly requestId: RequestId
    }
  }
}
```

Only `src/lib/server/platform/*` and SvelteKit entrypoints may access `App.Platform`.

### API gateway

```ts
type ApiRequest = {
  readonly request: Request
  readonly signal: AbortSignal
  readonly requestId: RequestId
}

type ApiGateway = {
  readonly forward: (input: ApiRequest) => Promise<Result<Response, ApiUnavailable>>
  readonly requestJson: <A, I>(input: {
    readonly path: ApiPath
    readonly init?: RequestInit
    readonly schema: Schema.Schema<A, I>
    readonly signal: AbortSignal
    readonly requestId: RequestId
  }) => Promise<Result<A, ApiUnavailable | ApiRejected | InvalidApiResponse>>
}
```

The production adapter calls `platform.env.API.fetch`. A recording test adapter implements the same behavior-shaped interface. Browser calls remain relative and go through SvelteKit gateway endpoints.

### Authorization

```ts
type AuthorizationFailure = Unauthenticated | Forbidden

declare const requirePrincipal: (
  principal: Principal,
  access: Exclude<RouteAccess, { readonly _tag: 'Public' }>
) => Result<AuthenticatedPrincipal, AuthorizationFailure>
```

`hooks.server.ts` resolves the session once per request into `locals.principal`. Each protected server load/action calls `requirePrincipal` before protected API work. Framework redirects are translated only at the route boundary.

### Player shell

```ts
type Player = {
  readonly state: Readable<PlayerState>
  readonly play: (item: QueueItem) => void
  readonly toggle: () => void
  readonly seek: (seconds: Seconds) => void
  readonly setVolume: (volume: Volume) => void
  readonly enqueue: (item: QueueItem) => void
  readonly remove: (queueItemId: QueueItemId) => void
  readonly destroy: () => Promise<void>
}
```

The Svelte adapter wraps the existing `@gbfm/player` runtime. It is created in the browser root layout, provided through Svelte context, and destroyed only when the root layout is destroyed—not on page navigation.

### Browser telemetry

```ts
type TelemetryEnvelope = {
  readonly version: 1
  readonly eventId: EventId
  readonly occurredAt: IsoDateTime
  readonly sessionId: AnonymousTelemetrySessionId
  readonly route: RouteId
  readonly release?: string
  readonly event: BrowserTelemetryEvent
}

type BrowserTelemetry = {
  readonly emit: (event: BrowserTelemetryEvent) => void
  readonly flush: (reason: 'interval' | 'pagehide' | 'visibility-hidden') => Promise<void>
}
```

Browser events are buffered, capped, sampled by event type, and sent with `navigator.sendBeacon` or `fetch(..., { keepalive: true })` to `POST /telemetry/browser`. The endpoint:

1. limits body size and batch count;
2. parses a strict Effect Schema;
3. discards forbidden fields rather than accepting arbitrary property bags;
4. writes fixed indexes/blobs/doubles to `BROWSER_TELEMETRY.writeDataPoint`;
5. emits structured `console.error` only for parsed defect events, allowing Workers Observability destinations to carry them;
6. returns `202` without making telemetry a product-flow dependency.

No user email, display name, raw content, request body, cookie, token, complete URL query string, or arbitrary stack object is accepted. Defect frames are reduced client-side to a bounded safe summary: error type, owned filename basename, line/column, route ID, release, and a stable fingerprint.

### Telemetry event contracts

```ts
type NavigationTelemetry = {
  readonly _tag: 'Navigation'
  readonly navigationId: NavigationId
  readonly from: RouteId
  readonly to: RouteId
  readonly trigger: 'link' | 'popstate' | 'programmatic'
  readonly outcome: 'complete' | 'cancelled' | 'failed'
  readonly intentToCompleteMs: Milliseconds
  readonly dataLoadMs?: Milliseconds
  readonly renderMs?: Milliseconds
}

type WebVitalTelemetry = {
  readonly _tag: 'WebVital'
  readonly name: 'CLS' | 'INP' | 'LCP' | 'TTFB'
  readonly value: number
  readonly rating: 'good' | 'needs-improvement' | 'poor'
}

type ApiFailureTelemetry = {
  readonly _tag: 'ApiFailure'
  readonly operation: string
  readonly route: RouteId
  readonly status?: number
  readonly errorTag: 'Network' | 'InvalidResponse' | 'ClientResponse' | 'ServerResponse'
  readonly durationMs: Milliseconds
}
```

Analytics Engine layout is fixed and documented in the adapter. `indexes[0]` is the anonymous telemetry session ID for sampling/query locality; blobs contain event tag, route ID, outcome/error tag, release, and request correlation ID; doubles contain durations and numeric values. High-cardinality authenticated user IDs are not stored.

### SEO

```ts
type PageMetadata = {
  readonly title: string
  readonly description: string
  readonly canonicalUrl: CanonicalUrl
  readonly robots: 'index,follow' | 'noindex,nofollow'
  readonly openGraph: OpenGraphMetadata
  readonly twitter: TwitterCardMetadata
  readonly jsonLd?: ReadonlyArray<JsonLdDocument>
}
```

Public `+page.server.ts` modules return `PageMetadata` beside page data. A shared Svelte head component renders it. Dynamic metadata uses the existing site-metadata API contract through the binding. Missing resources produce a real 404 and `noindex,nofollow`.

`/sitemap.xml`, `/rss.xml`, redirect `/s/*`, and social-card paths continue to use the existing owning Workers through explicit endpoint adapters. `robots.txt` remains static and points at the canonical sitemap.

## Seams, boundaries, adapters, and implementations

| Seam | Interface owner | Production adapter | Test adapter/evidence |
| --- | --- | --- | --- |
| API | `lib/server/api/api-gateway.ts` | Cloudflare service binding | recording Fetcher binding in workerd |
| Session | `lib/server/auth/session.ts` | Better Auth `/auth/get-session` through API binding | parsed session fixtures through gateway |
| Authorization | `lib/auth/authorization.ts` | pure domain module | focused table tests |
| Player | `lib/player/player.ts` | `@gbfm/player` Svelte adapter | browser Audio fake through public controls |
| Browser telemetry | `lib/telemetry/browser-telemetry.ts` | same-origin batch endpoint | recording endpoint via Playwright |
| Telemetry sink | `lib/server/telemetry/browser-telemetry-sink.ts` | Analytics Engine binding + Workers logs | recording dataset binding in workerd |
| Metadata | `lib/server/seo/page-metadata.ts` | API binding/static metadata | route SSR tests |
| Upload | retained framework-neutral upload modules | API/R2 presign endpoints | Playwright network fixtures + protocol unit tests |

## Call stacks and data flow

### Current / old public navigation

```text
link click
  -> TanStack Router
  -> React Query/client fetch
  -> public API hostname or Worker proxy
  -> JSON assumed by frontend types
  -> React render
  -> Sentry browser span/breadcrumb
```

Initial documents are the SPA shell; `seo-worker.ts` separately fetches metadata and rewrites `<head>`.

### Proposed initial public request

```text
GET /shows/example
  -> Cloudflare SvelteKit Worker
  -> hooks.server: request ID + session parse
  -> +page.server.ts
  -> ApiGateway.requestJson(ShowSchema)
  -> API service binding
  -> unknown JSON -> Effect Schema parser
  -> serializable ShowPageData + PageMetadata
  -> Svelte SSR HTML
  -> hydration reuses serialized page data
  -> Cloudflare request trace/log + safe timing fields
```

### Proposed client navigation

```text
pointer intent
  -> SvelteKit preload
link click
  -> beforeNavigate: NavigationId + monotonic start
  -> SvelteKit data request
  -> server load -> API binding -> parsed projection
  -> DOM update; root layout/player remains mounted
  -> afterNavigate: complete timing
  -> BrowserTelemetry.emit(Navigation)
  -> bounded batch -> /telemetry/browser -> Analytics Engine
```

### Auth sign-in

```text
form input
  -> SvelteKit action parses strict credentials DTO
  -> ApiGateway forwards POST /auth/sign-in/email via binding
  -> Better Auth response + Set-Cookie
  -> action forwards Set-Cookie on frontend origin
  -> redirect
  -> next hooks.server request parses /auth/get-session
  -> locals.principal = Authenticated
```

Credentials are never logged or included in telemetry. Auth failures return field-safe action failures; dependency failures return a generic user message and a safe error tag.

### Protected route

```text
GET /dashboard/users
  -> hooks.server resolves Principal
  -> route server load calls requirePrincipal(Admin)
  -> Unauthenticated => 303 /auth/sign-in?redirect=...
  -> Forbidden => 403
  -> Admin => API binding request -> parsed page data -> SSR
```

### Player

```text
Play button
  -> getPlayer() from root context
  -> QueueItem parser/constructor
  -> @gbfm/player command
  -> HTMLAudioElement / Spotify adapter
  -> PlayerState update
  -> root player UI update
  -> bounded Player telemetry event
```

Route navigation never constructs or destroys the player.

### Failure flow

```text
dependency throws unknown
  -> External Adapter Module classifies cancellation first
  -> typed ApiUnavailable/InvalidApiResponse/etc.
  -> route boundary maps to 404/401/403/5xx/error UI
  -> safe structured Worker log
  -> browser receives no raw cause
  -> optional ApiFailure event contains stable tag/status/duration only
```

Svelte `+error.svelte` provides user recovery. Root `handleError` emits a safe server log. Browser `error` and `unhandledrejection` listeners classify unknown values and emit only the constrained `UiDefectTelemetry` projection.

### Retry / cancellation / idempotency flow

- SvelteKit request `AbortSignal` propagates to API gateway calls. Superseded navigations are classified as cancelled, not failed.
- Reads are not automatically retried in the route layer. Existing API/cache policy remains authoritative.
- Mutations use form actions or existing upload state machines. Submit controls disable while pending; actions use redirects after success.
- Resumable multipart upload retains its existing upload ID/part idempotency and abort behavior.
- Telemetry delivery is best-effort, bounded, non-blocking, and never retried beyond one later flush of the in-memory batch.

### Observability flow

```text
Cloudflare request
  -> native Worker trace + invocation log
  -> existing planetaryescape traces/logs destinations

Browser navigation/vital/failure
  -> strict first-party event
  -> SvelteKit telemetry endpoint
  -> Analytics Engine data point
  -> optional structured Worker error log for defects
```

Correlation uses a generated/request-provided request ID plus Cloudflare's `cf-ray` where available. The ID crosses the website-to-API service-binding hop in `x-request-id`; it is safe and contains no user information.

The new frontend has no `@sentry/react`, Sentry Vite plugin, Sentry release variables, replay, Sentry tracer bridge, or Sentry analytics adapter. Source maps remain build artifacts unless Cloudflare source-map upload is explicitly configured in a later decision.

## Files to add / change / delete

### Add

- `apps/www/src/app.html`, `app.d.ts`, `hooks.server.ts`, `hooks.client.ts` — SvelteKit entrypoints, platform/local types, request/session scope, safe error handling.
- `apps/www/src/routes/**/+page.svelte`, `+page.server.ts`, `+layout.svelte`, `+layout.server.ts`, `+server.ts` — complete route tree grouped by access policy.
- `apps/www/src/lib/server/api/api-gateway.ts` — only API service-binding adapter and response parser.
- `apps/www/src/lib/server/auth/session.ts` and `apps/www/src/lib/auth/authorization.ts` — session boundary and pure access policy.
- `apps/www/src/lib/server/telemetry/browser-telemetry-sink.ts`, `apps/www/src/lib/telemetry/*` — strict event model, browser batching, Analytics Engine projection.
- `apps/www/src/lib/player/*` and Svelte player/queue components — Svelte adapter over `@gbfm/player`.
- Svelte components for navigation, content cards, MDX/music rendering, forms, editors, uploads, dashboards, errors, and development FPS diagnostics.
- `apps/www/e2e/route-manifest.spec.ts`, `navigation.spec.ts`, `auth.spec.ts`, `player.spec.ts`, `seo.spec.ts`, `telemetry.spec.ts`, `composer.spec.ts`, `upload.spec.ts`, `dashboard.spec.ts`, `responsive-navigation.spec.ts`.

### Change

- `alchemy/www.ts` — use `Cloudflare.Website.SvelteKit`; retain API/social bindings and domains; add Analytics Engine binding; keep `workerObservability`.
- `alchemy.run.ts` only if the dataset is declared at stack composition rather than inside `website`.
- `apps/www/package.json`, `vite.config.ts`, `tsconfig.json`, Playwright config — SvelteKit v3 toolchain and E2E projects; TypeScript remains `7.0.2`.
- Framework-neutral modules under `apps/www/src/lib`, upload services, analytics event call sites, and player decisions only where imports/types are React-specific.
- `docs/migrations/www-sveltekit.md` — mark accepted and link this specification after approval.

### Delete after parity is implemented

- All `apps/www/src/**/*.tsx`, `main.tsx`, `routeTree.gen.ts`, TanStack route/query setup, React hooks/providers, `seo-worker.ts`, and SPA `index.html`.
- React/TanStack/Radix React/dnd-kit/react-hook-form/lucide-react/Sentry React and Vite-plugin dependencies from `apps/www`.
- Sentry-only frontend services/tests and Sentry frontend environment variables.
- React-only `@gbfm/ui` consumption from `apps/www`; package itself remains for other applications.

No deletion occurs as an isolated cleanup phase: each old capability is removed in the same vertical slice that proves its replacement.

## RGR TDD test plan

Implementation proceeds as vertical behavior slices. Each bullet is one or more Red → Green → Refactor loops, not a horizontal “write all tests” phase.

1. **Runtime tracer:** failing workerd test that SSR `/` can call the API binding → minimal SvelteKit/Alchemy composition → refactor gateway boundary.
2. **Route contract:** failing manifest test compares the checked-in canonical route patterns with SvelteKit routes → add one route group at a time. The test checks explicit routes/redirects, not filesystem implementation trivia.
3. **Public content:** per resource family, add a failing direct-load + client-navigation E2E assertion using asymmetric fixture data → implement server load/page → assert SSR primary content and metadata.
4. **Shows and tweets performance:** failing test records request count and intent-to-visible duration under deterministic delayed API fixtures → implement preload/load boundaries → assert no duplicate request and a defined local budget. Production telemetry validates real latency separately.
5. **Auth:** failing action E2E for sign-in cookie/redirect/refresh/sign-out → implement proxy/action/session hook. Add unauthenticated and forbidden direct-load cases before protected page UI.
6. **Player:** failing E2E starts audio, navigates, and asserts the same media element/state continues → implement root provider/player controls. Add queue, seek, volume persistence, hotkeys, and mobile fullscreen one behavior at a time.
7. **Composer and MDX/music:** retain pure parser/resolution tests; add E2E for draft, publish, pending Spotify resolution gate, external media, and autosave before each UI capability is ported.
8. **Uploads:** retain upload state-machine tests; add E2E for multipart start/part/complete, resume, abort, image presign, validation failure, and S3 picker through network fixtures.
9. **Dashboard:** add E2E by capability group—personal settings, content CRUD, users/sessions, shows, music/playlists, newsletter/email, diagnostics—with authenticated role fixtures and observable requests/rendered state.
10. **SEO/discovery:** failing SSR tests for title/description/canonical/OG/JSON-LD and real 404; endpoint tests for robots/RSS/sitemap/social cards; JavaScript-disabled browser checks.
11. **Telemetry:** parser rejection tests for unknown/oversized/sensitive-shaped events; workerd recording-dataset test for projection; E2E asserts navigation/vitals/errors batch to the endpoint and that telemetry failure does not break navigation.
12. **Responsive/accessibility:** desktop and mobile Playwright projects cover nav, dialogs, keyboard/focus, reduced motion, color themes, and representative loading/empty/error states.

### Every-URL smoke matrix

- The canonical route manifest enumerates every static route and one fixture path per dynamic pattern.
- Each URL is requested directly and reached through client navigation where a corresponding link exists.
- Public routes assert non-error status, stable landmark/heading, no uncaught browser error, and expected indexability.
- Protected routes assert the correct redirect or role outcome.
- Endpoint routes assert content type and schema/XML shape rather than HTML.
- Desktop Chromium and mobile Chromium run the route matrix; focused critical flows run both, while expensive admin permutations may run desktop only where layout is not behaviorally different.

## Verification and PR gate

Before the PR opens:

- targeted unit/integration/workerd tests pass;
- every-URL Playwright matrix passes against a production build;
- focused E2E workflows pass;
- `bun precommit` passes without weakening checks;
- `vite build` through Alchemy's SvelteKit adapter succeeds;
- a Cloudflare preview is smoke-tested using the same route suite;
- inspected desktop and mobile screenshots cover home, content detail, shows, tweets, player active, auth, composer, dashboard, loading, empty, and error states;
- generated server/client bundle reports show no React, TanStack, or Sentry frontend runtime;
- the PR documents the one-time auth-session decision, route matrix, performance measurements, and visual evidence.

Production deploy, DNS cutover, and merge remain explicit approval actions. The current Cloudflare static site is the rollback artifact until post-deploy verification succeeds.

## Risks and open questions

1. **Existing sessions:** recommended default is a one-time re-authentication at cutover rather than broadening cookies to `.goosebumps.fm`. Approval is needed if retaining existing sessions is more important than minimizing cookie scope.
2. **SvelteKit v3 prerelease:** exact pinning and representative workerd tests are mandatory. If Alchemy's pinned integration fails, upgrade Alchemy and its frontend-framework package together; do not fall back to v2 config or a custom adapter.
3. **React-only packages:** CodeMirror core is framework-neutral, but current wrappers, dnd-kit, Radix React UI, image export, and FPS meter require Svelte implementations/replacements. Product behavior, not package identity, is the contract.
4. **MDX:** executing compiled React-flavored MDX is not retained. Parse/render the supported content vocabulary through Svelte components and sanitized HTML; unsupported arbitrary React components must fail explicitly.
5. **Analytics Engine retention/querying:** event layout, sampling, retention, and operational queries must be documented with the adapter. Cloudflare dashboard/query access is the initial backend; building a product analytics UI is not part of this rewrite.
6. **Frontend source maps:** removing Sentry source-map upload may reduce stack readability. The safe event fingerprint plus release/file/line fields is the baseline; Cloudflare source-map upload is a separate follow-up if native telemetry proves insufficient.

## Sources

- [Alchemy Cloudflare SvelteKit](https://alchemy.run/cloudflare/frontend/sveltekit/)
- [SvelteKit loading data](https://svelte.dev/docs/kit/load)
- [SvelteKit form actions](https://svelte.dev/docs/kit/form-actions)
- [SvelteKit authentication](https://svelte.dev/docs/kit/auth)
- [SvelteKit SEO](https://svelte.dev/docs/kit/seo)
- [SvelteKit observability](https://svelte.dev/docs/kit/observability)
