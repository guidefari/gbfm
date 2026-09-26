# `apps/www` SvelteKit big-bang migration

Status: accepted for implementation

Implementation contract: [`docs/www-sveltekit-tech-spec.md`](../www-sveltekit-tech-spec.md)

## Decision

Replace the React/TanStack Router single-page application in `apps/www` with one SvelteKit application deployed by `Cloudflare.Website.SvelteKit`. Do not retain React islands, an Astro shell, or a hybrid route system. Preserve the existing URLs and observable product behavior.

This is a framework rewrite, not a visual redesign. Existing TypeScript versions, development diagnostics such as the FPS meter, and framework-independent domain code remain unless the replacement has an equivalent implementation.

## Why SvelteKit

- **One rendering model.** Public content, authenticated tools, and interactive player UI use the same component and routing system instead of an Astro document layer bridged to React islands.
- **SSR by default.** Public content and route metadata arrive in the first response. This removes the SPA's crawler-specific metadata injection and makes route titles, descriptions, canonical links, Open Graph data, and structured data ordinary route output.
- **Persistent application shell.** A root layout can own navigation, audio playback, queue state, theme, and auth presentation across client-side navigations without remounting the player.
- **Route-owned data and mutations.** Server loads can fetch public and authenticated data during SSR. Form actions can handle auth and ordinary mutations with progressive enhancement, validation failures, redirects, and invalidation. Upload streaming and highly interactive editors remain purpose-built client workflows.
- **Navigation performance.** SvelteKit supplies intent preloading, parallel layout/page loads, dependency-aware invalidation, and reuse of SSR fetch responses during hydration. This is a cleaner basis for removing the observed tweets/shows navigation stalls.
- **Smaller browser runtime.** Svelte compiles components rather than shipping the React component runtime. The gain must still be measured because CodeMirror, media tooling, and product code will dominate some authenticated bundles.
- **First-party tracing points.** SvelteKit 2.31+ can emit OpenTelemetry spans for hooks, server loads, server-rendered universal loads, form actions, and remote functions. We can export these to our own OTLP backend instead of making Sentry the source of truth for server request timing.

## Cloudflare architecture

`Cloudflare.Website.SvelteKit` builds SvelteKit with an in-memory Cloudflare adapter, serves client/prerendered assets as Worker assets, and runs dynamic routes in the Worker. There is no Wrangler file, checked-in adapter, `svelte.config.js`, Railway service, or extra network hop.

The existing `API` and `SOCIAL_IMAGES` service bindings remain attached to the website Worker. Server loads and actions call the API binding directly. A SvelteKit server hook forwards browser requests for `/api`, Better Auth endpoints, `/health`, `/rss.xml`, `/sitemap.xml`, `/s/*`, and social-card paths to the relevant binding while preserving cookies and trace headers. The existing `www.goosebumps.fm` and `goosebumps.fm` domains remain on the website Worker.

```text
Browser
  │ same-origin documents, data, auth and mutations
  ▼
Cloudflare SvelteKit Worker
  ├─ root layout: nav, auth presentation, player, queue, theme
  ├─ server loads/actions: SSR data, authorization, ordinary forms
  ├─ client components: playback, editors, uploads, dialogs, drag/drop
  ├─ SEO: route head output, robots.txt, sitemap.xml
  └─ Cloudflare service bindings
       ├─ API Worker ── D1 / R2 / internal services
       └─ Social Image Worker
```

Authorization is enforced in server hooks and route-specific server loads/actions, not only in a parent layout load. SvelteKit layout loads do not necessarily rerun between child routes, and page/layout loads can run concurrently.

## Material tradeoffs

- This rewrites every React component, TanStack route, React Query hook, context/provider, and React-specific package integration. It is intentionally a big-bang cutover and therefore requires full route and workflow parity before merge.
- React-only libraries need Svelte or framework-neutral replacements. The riskiest areas are CodeMirror/MDX authoring, drag-and-drop playlist editing, image export, Better Auth client state, and the persistent audio player/queue.
- SvelteKit's built-in tracing and instrumentation are experimental and add overhead. Enable them deliberately, sample production traffic, and retain explicit browser navigation/Web Vitals events for time not represented by server spans.
- Alchemy's SvelteKit integration targets SvelteKit v3, which is currently prerelease. Pin exact versions and validate its Worker build and local binding proxy rather than silently falling back to SvelteKit v2 conventions.

## Scope and parity contract

The cutover includes:

- Public home, mixes, tracks, editorial, tweets, shows, releases, labels, tags, DJs, profiles, changelog, privacy, and terms routes.
- Auth sign-in, sign-up, verification, password recovery/reset, invite, subscribe/unsubscribe, and Spotify callback flows.
- Persistent player, queue, media keys, preferences, search, favorites, reminders, sharing, tweet navigation/replies/export, and offline status.
- Mix upload, resumable multipart upload, image upload, tweet/editorial composer, MDX/music embeds, external media, and autosave.
- The complete role-gated dashboard: profile, appearance, player, integrations, content, admin, users, sessions, shows, music, playlists, newsletter, email logs, search, and frontend error tools.
- Existing analytics contracts and the development FPS meter, with Svelte-native mounting.

Framework-neutral TypeScript modules should be retained and tested. React renderers, hooks, providers, route definitions, generated route tree, and React-only dependencies should be removed when their Svelte replacements land.

## SEO and discovery

- Keep SSR enabled for every indexable route.
- Give each page a unique title and description plus canonical, Open Graph, and Twitter metadata.
- Render content and JSON-LD in the server response; do not depend on post-hydration injection.
- Serve `robots.txt`, `rss.xml`, and a dynamic `sitemap.xml` through the SvelteKit Worker. The sitemap includes canonical public dynamic URLs and excludes auth/dashboard/private URLs.
- Preserve redirect status codes and canonical trailing-slash behavior.
- Verify representative responses with JavaScript disabled and validate structured data, sitemap XML, robots directives, and social-card URLs.

## Verification and cutover gate

1. Every current route has an explicit SvelteKit route, redirect, or intentional 404 covered by an automated route-manifest test.
2. Anonymous, signed-in, creator/editor, and admin browser smoke suites cover navigation and role boundaries; direct deep links and client navigations produce equivalent results.
3. Playback continues across route transitions; queue, media keys, volume, and player preferences work on desktop and mobile layouts.
4. Auth cookies survive SSR, client navigation, refresh, sign-in/out, verification, and password-reset flows through the service binding.
5. Composer, upload, dashboard CRUD, Spotify, search, subscription, favorite, reminder, reply, share, and export workflows pass focused tests.
6. Public route HTML contains its primary content and complete SEO metadata. `robots.txt`, RSS, sitemap, canonical URLs, and social images are validated.
7. Navigation telemetry separates browser intent-to-render, SvelteKit load spans, API time, hydration, and Core Web Vitals. Tweets and shows have explicit latency assertions.
8. Production build, unit tests, route smoke tests, accessibility checks, and `bun precommit` pass. Representative desktop/mobile and non-default states are visually compared before opening the replacement PR.
9. A Cloudflare preview deployment passes the same smoke suite before production cutover. The existing frontend remains the rollback target until production verification completes.

## Sources

- [Alchemy Cloudflare SvelteKit](https://alchemy.run/cloudflare/frontend/sveltekit/)
- [SvelteKit loading data](https://svelte.dev/docs/kit/load)
- [SvelteKit form actions](https://svelte.dev/docs/kit/form-actions)
- [SvelteKit authentication](https://svelte.dev/docs/kit/auth)
- [SvelteKit SEO](https://svelte.dev/docs/kit/seo)
- [SvelteKit observability](https://svelte.dev/docs/kit/observability)
