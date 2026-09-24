# Astro migration assessment for `apps/www`

Date: 2026-09-24

## Decision summary

Migrating `apps/www` to Astro in one production cutover is feasible, but it is a substantial application rewrite rather than a build-tool swap. The recommended target is:

- Astro owns every page route, document response, redirect, status code, and metadata tag.
- Cloudflare Workers render request-dependent pages through Alchemy's Astro resource.
- Existing React components remain React and become page-level or feature-level islands.
- A persistent browser runtime owns audio playback and the small amount of state that must survive page navigation.
- Public content is rendered into the initial HTML. Authenticated application screens may remain heavily hydrated, but still enter through Astro routes with server-side access checks.
- The current SEO injection Worker and TanStack Router are removed at cutover.

This is a **big-bang migration only**. All existing URLs switch to the Astro application together after the complete route matrix passes in staging. A catch-all Astro page that merely boots the existing SPA does not meet the definition of done: it would retain the router, client-only data loading, SEO workaround, and current JavaScript cost while changing only the outer build command.

Estimated implementation size is **46–74 engineer-days** (about **9–15 engineer-weeks** for one experienced engineer). A two-person team should plan for **6–9 calendar weeks**, including integration and cutover rehearsal. Three people can shorten some route work, but the global runtime, deployment, and final stabilization remain serial enough that a plan below five weeks is not credible without reducing scope.

Confidence is **medium**. The repository and official framework contracts are clear enough to establish the design and workload. Three high-impact compatibility questions require executable proofs before committing the full schedule: persistent audio across Astro navigation, Better Auth session validation through the API service binding, and the Alchemy Astro/Sentry production bundle.

## Why this is not a mechanical conversion

The current site is a client-rendered React application with one long-lived root tree:

```diagram
┌───────────────────────────────────────────────────────────────┐
│ React root                                                    │
│                                                               │
│ QueryClient → Theme → Player → Auth → TanStack Router        │
│                                      │                        │
│                                      └─ App shell + 71 URLs   │
└───────────────────────────────────────────────────────────────┘
```

Astro's normal model creates independently hydrated islands. React context does not cross those island boundaries. Splitting the current tree into unrelated islands would therefore disconnect page controls from the player, duplicate query/auth providers, and reset state during navigation.

The repository inventory quantifies the coupling:

| Measure | Current value | Migration implication |
| --- | ---: | --- |
| Unique generated URL paths | 71 | Every path needs an Astro route, redirect, or explicit removal decision. |
| Dashboard paths | 29 | A large authenticated application remains inside the site. |
| Route declarations | 73 | Layout and redirect routes must also be translated. |
| Files importing TanStack Router | 124 | Router removal extends well beyond `src/routes`. |
| Route files with loaders | 14 | Data loading must move to Astro request code or explicit client queries. |
| Route files with guards | 9 | Guards need server-side redirects and authorization checks. |
| Route files validating search state | 14 | URL decoding must retain the existing schema behavior. |
| Route files defining head metadata | 34 | Metadata becomes layout/page output rather than router state. |
| Files importing React Query | 35 | React Query remains useful inside interactive islands but no longer owns public document loading. |
| Files referring to browser globals | 51 | Server rendering will expose previously hidden import-time assumptions. |
| Production TS/TSX lines, excluding tests and generated route tree | 34,898 | Most domain/UI code is reusable; framework edges are not. |
| Unit tests | 154 across 34 files | Logic has a sound baseline, but route/render coverage is thin. |
| Browser test files | 3 | The cutover needs a much broader route and workflow suite. |

The current production build succeeds in 5.72 seconds and emits 4.1 MiB across 220 files. Its main JavaScript entry is 1,244.60 kB minified / 388.74 kB gzip, before route chunks. This gives Astro a meaningful performance opportunity on public pages, but only if those pages produce HTML and hydrate bounded interactive regions instead of mounting the whole application client-side.

Repository evidence:

- [`src/main.tsx`](../../apps/www/src/main.tsx) creates the root query, theme, player, auth, router, Sentry, and analytics runtime.
- [`src/routes/__root.tsx`](../../apps/www/src/routes/__root.tsx) owns the React app shell and global UI.
- [`src/services/player/PlayerProvider.tsx`](../../apps/www/src/services/player/PlayerProvider.tsx) creates one `Audio`, one Effect runtime, and player actions whose lifetime currently matches the SPA.
- [`src/components/Layout/AppShell.tsx`](../../apps/www/src/components/Layout/AppShell.tsx) places navigation, queue, and full-screen playback around every route.
- [`src/lib/api-client.ts`](../../apps/www/src/lib/api-client.ts) reads `window.location.origin` at module evaluation, so it cannot be imported by Astro server rendering unchanged.
- [`src/seo-worker.ts`](../../apps/www/src/seo-worker.ts) fetches API metadata and rewrites the SPA document because the current pages do not render metadata on the server.
- [`alchemy/www.ts`](../../alchemy/www.ts) deploys a static SPA plus that custom Worker.

## Target architecture

```diagram
                             Cloudflare Worker
┌─────────┐     ┌─────────────────────────────────────────────────────┐
│ Browser │────▶│ Astro route                                        │
└────┬────┘     │  ├─ middleware: session, guards, request context    │
     │          │  ├─ server data through API service binding         │
     │          │  ├─ status + canonical metadata + initial HTML      │
     │          │  └─ React island props                              │
     │          └──────────────┬──────────────────────┬───────────────┘
     │                         │                      │
     │                         ▼                      ▼
     │                  ┌────────────┐       ┌────────────────┐
     │                  │ API Worker │       │ Social images  │
     │                  └────────────┘       └────────────────┘
     │
     ▼
┌───────────────────────────────────────────────────────────────┐
│ ClientRouter                                                  │
│  ├─ persistent runtime island: audio, queue, nav, global UI   │
│  ├─ page/feature React islands                                │
│  └─ shared state through browser-owned stores/services        │
└───────────────────────────────────────────────────────────────┘
```

### Rendering model

Use Alchemy's `Cloudflare.Website.Astro` with server output. This is a Worker deployment, not a fully static build. Request-time rendering is required for dynamic public content, correct 404 responses, auth checks, and user-specific pages. Truly invariant routes such as legal text can opt into prerendering, but the deployment topology remains one Astro application.

Public detail routes (`mixes/[mixId]`, `tracks/[trackId]`, `editorial/[slug]`, `tweet/[slug]`, `shows/[showSlug]`, `labels/[labelSlug]`, `releases/[slug]`, `profile/[username]`, and the top-level slug route) should fetch their initial record on the server. Their response must contain the content, canonical metadata, and a real 404 before client JavaScript runs. Interactive controls can hydrate with that initial record.

Authenticated and authoring routes should run a server-side session/role check and then hydrate a larger page island. There is little benefit in rewriting complex editors, drag-and-drop, CodeMirror, uploads, or admin tables into Astro components. Keeping those surfaces as React is the lowest-risk use of Astro.

### Global browser runtime

The player cannot be instantiated separately inside each page island. It would stop audio and discard the queue whenever the body changes. Replace `PlayerActionsContext` with a browser-owned player service whose state is observable outside a React provider. The existing Effect atoms are a useful starting point, but construction/disposal and commands must also move out of React context.

Render one global runtime island from the shared Astro layout with `client:load` and `transition:persist`. It owns:

- the single `Audio` element and Effect player runtime;
- queue/full-screen player UI and media hotkeys;
- station navigation that depends on global playback/session state;
- global toast/dialog surfaces where cross-page persistence matters;
- browser analytics and Sentry initialization.

Page islands call the browser-owned player service and subscribe to its atoms rather than consuming an ancestor React context. This is the central application refactor. The proof must show uninterrupted playback, position, queue, volume, media-session handlers, and hotkeys across forward, backward, and programmatic Astro navigation.

Theme should be established before paint by a small inline layout script and represented on the document element. React consumers may subscribe to the same persisted value, but theme correctness must not depend on waiting for a provider to hydrate.

React Query can remain inside interactive pages. Do not force one persistent global query cache merely to reproduce the SPA. Public route data should be fetched by Astro and supplied as serializable initial data; client queries can use it as `initialData` where later refresh is required. Dashboard islands may construct a page-scoped query client because their data is already request- and user-specific.

### Routing conversion

Astro's `src/pages` tree replaces `src/routes` and `routeTree.gen.ts`.

| TanStack behavior | Astro replacement |
| --- | --- |
| `createFileRoute` / generated route tree | Files under `src/pages`, including `[param]` dynamic segments |
| `loader` | Astro frontmatter/server module for initial data; React Query for subsequent client refresh |
| `beforeLoad` | Middleware or an early `Astro.redirect()` after server session/role validation |
| `validateSearch` | Existing Effect schemas applied to `Astro.url.searchParams` and browser URL state |
| `head` | Typed props into a shared Astro layout |
| `errorComponent` | Expected error branches in the page plus Astro `404.astro` and `500.astro` |
| `Link` | Normal anchors, intercepted by Astro's `ClientRouter` for internal navigation |
| `useNavigate` / router navigation | `navigate()` from `astro:transitions/client` or browser history where appropriate |
| `Outlet` layouts | Astro layouts and shared page components |
| router scroll restoration | ClientRouter behavior plus explicit tests for the custom main scroll container |

The migration removes `@tanstack/react-router`, `@tanstack/router-plugin`, and `routeTree.gen.ts`. It should not introduce a local general-purpose router. Small URL builders for repeated dynamic paths are reasonable; recreating route matching, loaders, or nested outlets is not.

### Data and authentication

Create separate browser and server API entry points. The browser client can retain the current HTTP API client and credential behavior after removing its import-time `window` dependency. The server client must use the bound API Worker's `fetch` implementation so public SSR does not make an avoidable Internet round trip.

Astro middleware should forward the incoming cookie header to the API's Better Auth session endpoint and expose the decoded user/session through typed `Astro.locals`. Because the Better Auth instance lives in the API application, the stock example that imports `auth.api.getSession()` directly is not applicable as written. The equivalent remote call must also propagate any session-refresh `Set-Cookie` response back to the browser.

Authorization remains enforced by the API. Astro guards improve document behavior and prevent protected UI flashes; they do not replace backend authorization.

The current client auth hook can remain for reactive sign-in/sign-out state inside islands, seeded with the server result where practical. Test cookie domain, secure/same-site attributes, sign-in redirects, email verification, reset links, Spotify callback return paths, and session revocation on real staging hostnames.

### SEO, errors, and edge routes

Astro pages should render the existing `@gbfm/site-metadata` results directly in the document head. This makes [`src/seo-worker.ts`](../../apps/www/src/seo-worker.ts) unnecessary and removes its duplicate route-recognition table.

Preserve the Worker's non-SEO behavior through Astro endpoints or middleware:

- `/sitemap.xml` forwards to the API binding;
- `/social/cards/*` and `/social/tweets/*` forward to the social-image binding;
- RSS, sitemap, and `/s/*` Cloudflare redirects retain their current production contract;
- missing public entities return a real 404 with `noindex`, not a successful SPA shell;
- private pages always emit `noindex, nofollow`.

Keep the existing `_headers` intent, but verify which rules apply to static assets versus Worker-generated HTML. Astro's hashed assets can retain immutable caching. Personalized or auth-sensitive documents must not inherit the current public 60-second document cache policy.

### Build, deployment, and observability

Replace `Cloudflare.Website.StaticSite` with `Cloudflare.Website.Astro` in [`alchemy/www.ts`](../../alchemy/www.ts):

- `rootDir: "apps/www"`;
- server output;
- existing domain and aliases;
- `API` and `SOCIAL_IMAGES` bindings;
- `sessionKVBindingName: false`, because Astro Sessions are not the authentication store;
- current public client configuration and server-only Sentry configuration as distinct bindings;
- the existing Worker observability settings.

Add `astro`, `@astrojs/react`, `@sentry/astro`, and `@alchemy.run/frontend-frameworks`. Alchemy injects its Cloudflare adapter, so `astro.config.ts` must not declare another adapter. Reuse Tailwind's Vite plugin and evaluate the two local Vite plugins (`theme-colors` and `repo-changelog`) under Astro rather than duplicating their output.

Replace the browser-only `@sentry/react` bootstrap with Sentry's Astro integration plus its browser configuration. Verify both Worker and browser events, release names, trace propagation to the API, replay privacy settings, and source maps from the Alchemy-produced bundle. Alchemy already adds `nodejs_compat`; Sentry's Cloudflare runtime requires it.

## Required workstreams

The ranges below include implementation and focused tests, not schedule padding.

| Workstream | Scope | Estimate |
| --- | --- | ---: |
| Executable feasibility gate | Minimal Alchemy Astro Worker; one SSR public route; remote session check; persistent audio/navigation proof; browser + Worker Sentry proof | 4–7 days |
| Framework and deployment foundation | Package/config/scripts, layouts, styles/fonts/theme bootstrap, environment typing, Alchemy resource, local dev and preview | 4–6 days |
| Global runtime redesign | Player service, persistent island, queue/nav/full-screen UI, theme, toasts, auth seed, analytics lifecycle | 7–12 days |
| Routing and navigation removal | 71-path Astro tree, links/navigation/search params/redirects/layouts, deletion of generated router assets | 8–13 days |
| Server data, auth, and SEO | Bound API client, middleware/locals, public SSR, initial-data handoff, metadata, 404/500, edge forwarding | 8–12 days |
| Complex application surfaces | Dashboard, authoring, upload, Spotify callback, reminders, editor and drag/drop hydration fixes | 7–11 days |
| Observability and production hardening | Sentry, source maps, headers/caching, tracing, bundle/runtime checks | 3–5 days |
| Regression suite and cutover rehearsal | Route contract suite, critical E2E workflows, accessibility/visual checks, load/error checks, rollback rehearsal | 5–8 days |
| **Total** | Some route work can run concurrently after the runtime contract is fixed | **46–74 days** |

The estimate assumes no product redesign and no API schema changes. It also assumes existing React UI and domain libraries remain. Rebuilding visual components in `.astro`, replacing React Query, or redesigning dashboard flows would be separate scope.

## Feasibility gate

Do not start bulk route conversion until a disposable, non-production proof demonstrates all of the following together:

1. Alchemy builds and serves an Astro SSR Worker with `API` and `SOCIAL_IMAGES` bindings.
2. A dynamic public route fetches through the API binding, emits meaningful HTML and metadata, and returns a real 404.
3. Middleware validates an existing Better Auth cookie through the API binding and correctly forwards a refreshed cookie.
4. A persisted global island continues playing audio while navigating between two Astro pages, including browser back/forward.
5. A React page island can invoke player commands and observe playback without React ancestor context.
6. Browser and Worker Sentry events arrive with readable source maps and the expected release/environment.
7. `astro preview` runs the production build under the Cloudflare-compatible runtime.

If the persistent-island proof fails, the architecture must be revised before estimating route conversion again. Shipping a root SPA island is not an acceptable fallback under this migration's definition of done.

## Test and cutover gates

The current 154 unit tests should remain green throughout the work, but they are not enough to authorize cutover. Add a generated route-contract suite that exercises every current URL against the production build and records:

- status and redirect destination;
- title, canonical URL, robots policy, Open Graph, and Twitter metadata;
- presence of meaningful server-rendered content on public routes;
- authenticated versus anonymous behavior;
- expected cache headers;
- hydration without console errors or duplicate network requests.

Critical browser workflows must cover:

- first load, internal navigation, back/forward, scroll restoration, focus, and route announcement;
- play, pause, seek, queue edits, volume, media-session controls, and uninterrupted cross-page audio;
- sign-up, sign-in, sign-out, verification, password reset, protected redirect return, and revoked sessions;
- public listing/detail pages and true not-found responses;
- dashboard role gates and representative read/mutation flows;
- tweet/editorial creation and editing, including unsaved-change protection;
- mix upload, resumable upload, and draft recovery;
- Spotify connect/callback state;
- theme before paint and across navigation;
- offline banner and recoverable route/API failures;
- social cards, sitemap, RSS, and share redirects.

Before the production switch:

1. Run `bun precommit`, all `apps/www` unit tests, the full route-contract suite, and browser workflows against a production build.
2. Crawl staging with JavaScript disabled and verify public content, links, metadata, status codes, and accessibility landmarks.
3. Compare core web vitals, HTML response latency, Worker errors, API request counts, and client JavaScript against the current site.
4. Rehearse deployment rollback to the last static-site Worker without changing API or data.
5. Freeze unrelated `apps/www` changes, deploy the complete Astro build to staging, and run the entire matrix again.
6. Switch the production website deployment once. Keep the prior Worker version available for immediate rollback during the observation window.

The production cut is blocked by any route mismatch, auth-cookie uncertainty, audio reset, hydration error on a critical route, missing Sentry visibility, or untested rollback.

## Principal risks

| Risk | Likelihood / impact | Control |
| --- | --- | --- |
| Audio runtime resets during document swaps | High / critical | Persistent-island proof before route work; externalize actions/state from React context; dedicated browser tests. |
| Independent islands lose shared context | Certain without redesign / critical | Define browser-owned services/stores; keep each tightly coupled interactive surface in one island. |
| Browser-only modules fail SSR | High / high | Split server/browser API modules; test importing and rendering every public page under workerd. |
| Remote session validation mishandles cookie refresh | Medium / critical | Forward request cookies and response `Set-Cookie`; test expiry/refresh/revocation on staging domains. |
| Route semantics regress while removing typed router APIs | High / high | Generate the route matrix from the current route tree; schema-test params/search/redirects before deleting it. |
| Public pages hydrate too much JavaScript to justify Astro | Medium / high | Set per-route bundle budgets and reject whole-app islands; measure against the current 388.74 kB gzip entry. |
| ClientRouter lifecycle duplicates analytics/listeners | Medium / medium | Initialize on Astro lifecycle events with idempotent cleanup; test repeated navigation. |
| Cloudflare headers cache personalized HTML | Medium / critical | Separate immutable asset rules from Worker responses; explicitly test anonymous and authenticated cache headers. |
| Alchemy Astro and Sentry integration differ from standard adapter docs | Medium / high | Prove the exact repository deployment path, bundle, bindings, source maps, and rollback before bulk conversion. |
| Existing browser coverage misses complex admin/editor regressions | High / high | Expand Playwright around business-critical workflows before cutover. |

## Definition of done

The migration is complete only when:

- Astro owns all 71 existing URL contracts.
- TanStack Router, its Vite plugin, generated route tree, and SEO injection Worker are gone.
- Public route responses contain their content and metadata without executing JavaScript.
- Missing entities return real 404 responses.
- Protected pages are checked before rendering and API authorization remains intact.
- Audio and queue state survive every internal navigation mode supported today.
- The main app shell no longer depends on one root React router tree.
- The production Cloudflare deployment uses Alchemy's Astro resource with service bindings.
- Browser and server observability, source maps, cache policy, redirects, and edge endpoints are verified.
- The full route and workflow matrix passes against the production bundle.
- A tested deployment rollback exists and does not require a data rollback.

## Sources

### Repository

- [`apps/www/package.json`](../../apps/www/package.json)
- [`apps/www/src/main.tsx`](../../apps/www/src/main.tsx)
- [`apps/www/src/routeTree.gen.ts`](../../apps/www/src/routeTree.gen.ts)
- [`apps/www/src/routes`](../../apps/www/src/routes)
- [`apps/www/src/seo-worker.ts`](../../apps/www/src/seo-worker.ts)
- [`apps/www/src/services/player`](../../apps/www/src/services/player)
- [`apps/www/vite.config.ts`](../../apps/www/vite.config.ts)
- [`alchemy/www.ts`](../../alchemy/www.ts)
- [`alchemy/dns.ts`](../../alchemy/dns.ts)

### Primary external references

- Astro, [front-end frameworks and hydration directives](https://docs.astro.build/en/guides/framework-components/)
- Astro, [islands architecture](https://docs.astro.build/en/concepts/islands/)
- Astro, [sharing state between islands](https://docs.astro.build/en/recipes/sharing-state-islands/)
- Astro, [view transitions, `ClientRouter`, and persisted islands](https://docs.astro.build/en/guides/view-transitions/)
- Astro, [on-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/)
- Astro, [middleware and request locals](https://docs.astro.build/en/guides/middleware/)
- Astro, [server endpoints](https://docs.astro.build/en/guides/endpoints/)
- Astro, [React integration](https://docs.astro.build/en/guides/integrations-guide/react/)
- Astro, [Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- Astro, [testing](https://docs.astro.build/en/guides/testing/)
- Alchemy, [Astro on Cloudflare](https://alchemy.run/cloudflare/frontend/astro)
- Better Auth, [Astro integration](https://better-auth.com/docs/integrations/astro)
- Better Auth, [session management](https://better-auth.com/docs/concepts/session-management)
- Sentry, [Astro SDK](https://docs.sentry.io/platforms/javascript/guides/astro/)
- Sentry, [Astro on Cloudflare](https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/astro/)
