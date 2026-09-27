# `@gbfm/www`

Foldkit renders public pages on the server and keeps the audio player alive across client navigation. Effect owns application services and commands. The Cloudflare Worker forwards API requests through its `API` service binding; browser credentials remain same-origin.

## Development and verification

From the repository root:

```sh
bun run --cwd apps/www dev
bun precommit
bun run --cwd apps/www unit
bun run --cwd apps/www build
```

`VPS_PROXY_TARGET` selects the development API origin (default `http://127.0.0.1:3003`). Do not set a browser API origin: it would bypass the same-origin session cookie. `VITE_SPOTIFY_CLIENT_ID` configures Spotify PKCE.

Development uses Foldkit's standalone SSR and view-identity plugins. The aggregate plugin's reload preservation caches a model on the Vite server by runtime ID, not browser session; it can replace a fresh visitor's SSR state after code changes. We deliberately forgo that preservation for this authenticated app. Production still uses the aggregate build plugin.

Browser tests use `PLAYWRIGHT_BASE_URL` and an optional `CHROMIUM_PATH`. `bun run --cwd apps/server dev:e2e` starts the disposable, migrated D1 fixture API, including local creator/admin/listener accounts. This does not seed a shared database. Set `FRONTEND_URL` to the test web origin and `PORT` to the API port; point the web process's `VPS_PROXY_TARGET` at that API. Then run `bun run --cwd apps/www e2e`.

## Observability

Every server request receives an `x-request-id`, also forwarded to the API. Completion/failure logs use bounded route names and exclude request bodies, cookies and raw URLs. Browser telemetry covers navigation, Web Vitals and player events.

In Vite development, Effect exports SSR spans to `http://127.0.0.1:4318/v1/traces`. Set `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` to select another local collector. The request's W3C `traceparent` reaches downstream API requests. Export is batched, and Vite module disposal flushes/closes the tracer. Production does not bundle this local exporter: Cloudflare logs/traces are configured in `alchemy/observability.ts`. Local export tests are not proof of production ingestion or alert delivery.

## Changelog

The repository root `CHANGELOG.md` is the only source of truth. `plugins/repo-changelog.ts` exposes its raw text as `virtual:repo-changelog` and watches it in development. `src/entry.server.ts` supplies it only to the changelog route; `src/rich-content.ts` renders writing as inert markup rather than evaluating compiled MDX. Do not create a second tracked changelog copy.
