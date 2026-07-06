# Migration: Hono + zod-openapi → Effect HttpApi

> All API names in this doc are verified against the installed `effect@4.0.0-beta.70`
> (effect-smol) type definitions. Snippets marked "spike" need runtime validation
> before being treated as load-bearing.

## Why?

The VPS server (`apps/vps`) uses Hono + `@hono/zod-openapi` for route definitions. The web client (`apps/www`) has ~1400 lines of hand-written react-query hooks with manually typed fetch calls (~50+ API endpoints). There is zero shared type safety between server and client -- response types are duplicated, paths are stringly-typed, and errors are handled ad-hoc.

Effect's `unstable/httpapi` module (already in the dependency tree at `effect@4.0.0-beta.70`, in both `apps/vps` and `apps/www`) provides:

- **Shared contract**: One `HttpApi` definition at the domain boundary, consumed by both server and client
- **Auto-generated type-safe client**: `HttpApiClient.make(Api)` produces a fully typed client with correct params, query, payload, response, and error types
- **Built-in OpenAPI generation**: `OpenApi.fromApi()` produces the spec directly from declarative endpoint definitions, and `HttpApiScalar.layer(Api)` serves a docs UI (replaces `@scalar/hono-api-reference`)
- **Native middleware system**: Auth, rate limiting, logging, and tracing become typed Effect middleware with schema-declared errors and service requirements
- **No codegen step**: Types flow from schemas at the type level, no build-time code generation

**The bet being made**: `unstable/httpapi` lives in a beta release. It is pinned exactly (`4.0.0-beta.70`) in both apps, which contains the churn, but every version bump until Effect 4 stable is a potential API break in the route layer. This is the single biggest risk of Option A and the main argument for the staged path in the Decision section.

## Current Architecture

### Server (`apps/vps`)

```
Route files (*.routes.ts)   →   Zod schemas + createRoute()
Route handlers (*.handlers.ts)  →  AppRouteHandler<R> + runEffect()
Router assembly (*.index.ts)    →  createRouter().openapi(route, handler)
App assembly (app.ts)      →  app.route('/api/x', router)
                          →  Bun.serve({ fetch: app.fetch })

Middleware:
  - app.use('*', cors(...))          → global CORS
  - app.use('*', requestId())        → request ID header
  - app.use('*', effectLogger())     → OpenTelemetry spans + logging
  - app.use('*', standardRateLimiter()) → global rate limiter
  - app.notFound(notFound)           → 404 handler
  - app.onError(onError)            → global error handler + Sentry

Per-route middleware (via route definition's `middleware` array):
  - betterAuthMiddleware   → session validation, sets c.get('user')
  - requireAdminMiddleware → role check
  - strictRateLimiter / relaxedRateLimiter → endpoint-specific limits

Error handling:
  - effect-hono.ts: runEffect() maps Effect tagged errors → HTTP status codes
  - Domain errors: NotFoundError(404), ConflictError(409), UnauthorizedError(401)...
  - These are Data.TaggedError classes, not Schema-based.

Auth model (important -- drives Phase 4a):
  - Cookie-based sessions. betterAuthMiddleware calls auth.api.getSession({ headers })
    which reads the better-auth session cookie. The client sends credentials: 'include'.
  - Nothing in the system uses Authorization: Bearer.
```

**Not just routes.** `app.ts` also owns production subsystems that any migration must carry over explicitly (they do not live in route files and are easy to lose):

- `runAppFork(reminderLoopEffect)` -- the music-reminders background loop. If this silently stops, reminders stop firing with no error anywhere.
- `runAppFork(sitemapRegenerationEffect)` -- hourly sitemap rebuild
- Graceful shutdown -- SIGTERM/SIGINT → `disposeRuntime()`
- `/health/live`, `/health/ready`, `/health` -- readiness with a 5s DB-check cache; deploy orchestration probes these; they are excluded from rate limiting
- Root-mounted non-API routers: `rss` (HTML/XML), `seoRouter` (`sitemap.xml`), `shareRouter` (`/s`, HTML share pages + redirects). These are externally referenced public URLs.
- `/auth` -- better-auth, mounted at root (its basePath appears in emailed links)
- `/doc` -- OpenAPI spec + Scalar UI
- `Bun.serve` with `maxRequestBodySize: 1GB` (uploads depend on this)

### Client (`apps/www`)

```
~50 react-query hooks in lib/http.ts → fetcher(apiUrl('/path')) with manual type params
                                       path strings, method strings, body serialization,
                                       response types all hand-written per hook
Base URL: VITE_VPS_BASE_URL (cross-origin in prod), cookies via credentials: 'include'
```

### Available Effect infrastructure

- `runtime/index.ts`: Built-once `Scope` + `Layer`, `AppRuntime.runPromise/runPromiseExit/runFork`
- `runtime/services.ts`: `Layer.mergeAll(...)` composing all domain services, exported as `AppLayer`
- All domain services are typed as `Context.Service<X, { ... }>` -- can be injected via `Layer.provide`

---

## Option A: Full migration to Effect HttpApi

### High-level plan

1. Define a shared API contract using `HttpApi.make()` + `HttpApiGroup` + `HttpApiEndpoint`
2. Port each Hono route definition to an `HttpApiEndpoint`
3. Convert `@hono/zod-openapi` Zod schemas to Effect `Schema` objects
4. Port route handlers from `AppRouteHandler<R>` Hono handlers to `HttpApiBuilder.group()` handlers
5. Port domain errors (currently `Data.TaggedError`) to `Schema.TaggedErrorClass` with status annotations
6. Port middleware: auth to `HttpApiMiddleware.Service`; CORS, rate limiting, logging, and Sentry to global `HttpRouter.middleware`
7. Replace `Bun.serve({ fetch: app.fetch })` with `HttpRouter.toWebHandler()`, keeping the Hono app mounted as a wildcard fallback during migration
8. On the client, generate the typed client via `HttpApiClient.make(Api)`
9. Gradually replace react-query hooks with calls through the typed client

### Phase 1: Shared schemas and API contract (`packages/api`)

Create a new workspace package `packages/api` that defines the public API contract. It must be a leaf package: **no imports from `apps/vps`**, or server-only code leaks into the www bundle when the client imports the contract. (Co-locating in `apps/vps/src/api/` is possible but makes that leak a one-import mistake; a separate package makes it structurally impossible.)

```ts
// packages/api/src/api.ts
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup } from "effect/unstable/httpapi"

// ── Errors ────────────────────────────────────────────────────
// Use the built-in error classes where the shape suffices. They are
// Schema-based tagged errors with the status annotation already attached:
// HttpApiError.BadRequest(400), Unauthorized(401), Forbidden(403),
// NotFound(404), Conflict(409), InternalServerError(500), ...
//
// Do NOT define errors as anonymous structs like
// Schema.Struct({ error: Schema.String }) with different statuses:
// structurally identical schemas cannot be discriminated at runtime,
// so the builder cannot pick the right status code. Errors must be
// tagged. Custom domain errors: see Phase 2.

// ── Response schemas ──────────────────────────────────────────
export const HealthResponse = Schema.Struct({ ok: Schema.Literal(true) })

export const ArtistListResponse = Schema.Struct({
  items: Schema.Array(Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    slug: Schema.String,
    imageUrl: Schema.optional(Schema.String),
  })),
})

export const ArtistDetailResponse = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  bio: Schema.optional(Schema.String),
  imageUrl: Schema.optional(Schema.String),
  genres: Schema.optional(Schema.Array(Schema.String)),
})

export const CreateArtistInput = Schema.Struct({
  name: Schema.String,
  bio: Schema.optional(Schema.String),
  imageUrl: Schema.optional(Schema.String),
  genres: Schema.optional(Schema.Array(Schema.String)),
})

// ── API groups ────────────────────────────────────────────────
export const HealthGroup = HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("check", "/health", {
    success: HealthResponse,
  }),
)

export const MusicGroup = HttpApiGroup.make("music").add(
  HttpApiEndpoint.get("listArtists", "/api/music/artists", {
    success: ArtistListResponse,
  }),
  HttpApiEndpoint.get("getArtist", "/api/music/artists/:id", {
    params: { id: Schema.String },
    success: ArtistDetailResponse,
    error: HttpApiError.NotFound,
  }),
  HttpApiEndpoint.post("createArtist", "/api/music/artists", {
    payload: CreateArtistInput,
    success: ArtistDetailResponse,
    error: HttpApiError.BadRequest,
  }),
)

// ── Composed API ──────────────────────────────────────────────
export const Api = HttpApi.make("gbfm")
  .add(HealthGroup)
  .add(MusicGroup)
```

**Key changes from current pattern:**
- `createRoute({ path, method, request: {...}, responses })` → `HttpApiEndpoint.get/post(name, path, { params, query, payload, success, error })`
- `error` accepts a single schema or a readonly array of schemas (`error: [HttpApiError.NotFound, MyDomainError]`)
- Zod schemas → Effect `Schema` objects (same concepts, different import)
- `jsonContent(schema, desc)` in responses → direct `success`/`error` schema fields
- 500s from unexpected failures do not need declaring per endpoint; declared errors are the *expected* failure modes

### Phase 2: Port domain errors

Current errors like `NotFoundError` use `Data.TaggedError`, which is opaque to the schema system. Port them to `Schema.TaggedErrorClass` with the `httpApiStatus` annotation (the same mechanism the `HttpApiError` built-ins use internally):

```ts
// Current:
export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly message: string
  readonly resource?: string
}> {}

// New (packages/api):
export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
  "NotFoundError",
  {
    message: Schema.String,
    resource: Schema.optional(Schema.String),
  },
  { httpApiStatus: 404 },
) {}
```

The annotation must be attached to the class schema that endpoints reference. `HttpApiSchema.status(404)(schema)` is the equivalent for plain (non-class) schemas -- note it *returns a new annotated schema*; assigning its result to an unused static on the class does nothing.

This preserves the tagged error pattern (`yield* new NotFoundError({ message: "..." })` is yieldable directly) while making errors encodable by the HTTP API layer and discriminable by `_tag`.

### Phase 3: Port server handlers

Replace the 3-file pattern (routes + handlers + index) with `HttpApiBuilder.group()`.

**Current pattern** (music.routes.ts + music.handlers.ts + music.index.ts):
```ts
// music.routes.ts
export const listArtists = createRoute({
  method: 'get',
  path: '/artists',
  tags: ['music'],
  responses: {
    200: jsonContent(ArtistListResponse, 'List of artists'),
    500: jsonContent(errorSchema, 'Error'),
  },
})

// music.handlers.ts
export const listArtists: AppRouteHandler<typeof listArtists> = async (c) => {
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.listArtists()
  })
  return runEffect(c, program)
}

// music.index.ts
const router = createRouter()
  .openapi(listArtists, handlers.listArtists)
  .openapi(getArtist, handlers.getArtist)
export default router
```

**New pattern**:
```ts
// apps/vps/src/routes/music.handlers.ts
export const MusicHandlers = HttpApiBuilder.group(Api, "music", (handlers) =>
  handlers
    .handle("listArtists", () =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const items = yield* svc.listArtists()
        return { items }
      })
    )
    .handle("getArtist", ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const artist = yield* svc.getArtist(params.id)
        if (!artist) return yield* new HttpApiError.NotFound()
        return artist
      })
    )
    .handle("createArtist", ({ payload }) =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        return yield* svc.createArtist(payload)
      })
    ),
)
```

Handlers receive `{ params, query, payload, headers, request }` based on the endpoint schemas -- fully typed with no manual extraction. Failures must be instances of the declared tagged error classes (`yield* new HttpApiError.NotFound()`), not plain objects -- the builder encodes the response status from the error's schema annotation. The `runEffect` wrapper is no longer needed.

### Phase 4: Port middleware

#### 4a. Auth middleware

**The app is cookie-based, not bearer-based.** `betterAuthMiddleware` calls `auth.api.getSession({ headers })`, which reads the better-auth session cookie; www sends `credentials: 'include'`. Nothing sends `Authorization: Bearer`, so porting auth as `HttpApiSecurity.bearer` would 401 every authenticated request in production.

The honest port is an ordinary (non-security) `HttpApiMiddleware` that reads the request headers and calls `getSession`, exactly like today. Middleware effects have `HttpServerRequest` available in context.

```ts
// packages/api/src/middleware/auth.ts
import { Context } from "effect"
import { HttpApiError, HttpApiMiddleware } from "effect/unstable/httpapi"

export class AuthSession extends Context.Service<AuthSession, {
  readonly user: { id: string; name: string; email: string; role: string }
  readonly session: { id: string }
}>()("api/AuthSession") {}

export class AuthMiddleware extends HttpApiMiddleware.Service<AuthMiddleware>()(
  "api/AuthMiddleware",
  {
    provides: AuthSession,
    error: HttpApiError.Unauthorized,
  },
) {}
```

Two things that are load-bearing here:
- `provides` needs a real context key. `AuthSession` uses the same `Context.Service` pattern as the rest of the codebase (`runtime/services.ts`); a plain class will not typecheck.
- The middleware **must declare its error schema** (`error: HttpApiError.Unauthorized`). Middleware failures are added to the endpoint error surface and must be encodable; failing with an undeclared plain object is a type error.

Server-side implementation:
```ts
// apps/vps/src/middleware/auth.impl.ts
import { Effect, Layer } from "effect"
import { HttpServerRequest } from "effect/unstable/http"
import { HttpApiError } from "effect/unstable/httpapi"
import { AuthMiddleware, AuthSession } from "@gbfm/api"
import { auth } from "@/lib/auth"

export const AuthMiddlewareLive = Layer.succeed(
  AuthMiddleware,
  (httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest
      const session = yield* Effect.tryPromise({
        try: () => auth.api.getSession({ headers: new Headers(request.headers) }),
        catch: () => new HttpApiError.Unauthorized(),
      })
      if (!session) {
        return yield* new HttpApiError.Unauthorized()
      }
      return yield* Effect.provideService(httpEffect, AuthSession, {
        user: session.user,
        session: session.session,
      })
    }),
)
```

Attach to a group or API:
```ts
const Api = HttpApi.make("gbfm")
  .add(AdminGroup.middleware(AuthMiddleware))
```

**Admin checks**: handlers on authed groups do `const { user } = yield* AuthSession` and fail `HttpApiError.Forbidden` on non-admin roles (declare it on those endpoints). A dedicated `RequireAdminMiddleware` is possible but adds nothing over three lines in the handler.

**Optional session** (current `attachSessionContext`): a second middleware that provides an `Option`-shaped service and never fails:

```ts
export class OptionalAuthSession extends Context.Service<OptionalAuthSession, {
  readonly session: Option.Option<{ user: ...; session: ... }>
}>()("api/OptionalAuthSession") {}
```

The implementation calls `getSession`, wraps the result in `Option.fromNullable`, and always provides. There is no built-in `.optional` wrapper on services; this explicit second service is the mechanism.

If an OpenAPI security scheme is wanted for the spec later, `HttpApiSecurity.apiKey({ in: "cookie", key: "<session-cookie-name>" })` exists -- but the implementation still needs the full header set for better-auth, so the plain middleware above remains the implementation either way.

#### 4b. Rate limiting

The current limiter sets `X-RateLimit-*` headers on **every** response and applies to all routes (`app.use('*')`), including better-auth and RSS. That makes it a router-level concern, not an endpoint-schema concern: port it as global `HttpRouter.middleware`, which wraps the response effect and can modify responses. (Do **not** use the `toWebHandler` `middleware` option for this -- see the CORS warning in 4d.)

`InMemoryRateLimiter` (the class) is transport-agnostic and moves over unchanged. `getClientKey` is typed against Hono's `Context` and needs a header-record twin. Note the module-private `limiter` singleton is not exported today; the Effect port instantiates its own.

```ts
// apps/vps/src/middleware/rate-limiter.impl.ts
import { Effect } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { InMemoryRateLimiter } from "@/middlewares/rate-limiter"

const limiter = new InMemoryRateLimiter()
const EXCLUDED = new Set(["/health", "/health/live", "/health/ready"])

const clientKey = (headers: Readonly<Record<string, string | undefined>>) => {
  const forwarded = headers["x-forwarded-for"]
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown"
  return headers["x-real-ip"] ?? "unknown"
}

const configFor = (path: string) => {
  if (path.startsWith("/api/music/tracks") && path.endsWith("/play"))
    return { windowMs: 60_000, maxRequests: 5 }
  if (path.startsWith("/api/admin")) return { windowMs: 60_000, maxRequests: 10 }
  return { windowMs: 60_000, maxRequests: 60 }
}

export const RateLimiterLive = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest
      const path = new URL(request.url, "http://localhost").pathname
      if (EXCLUDED.has(path)) return yield* httpEffect

      const config = configFor(path)
      const result = limiter.check(`${path}:${clientKey(request.headers)}`, config)

      const headers = {
        "x-ratelimit-limit": String(config.maxRequests),
        "x-ratelimit-remaining": String(result.remaining),
        "x-ratelimit-reset": String(Math.ceil(result.resetAt / 1000)),
      }

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
        return HttpServerResponse.jsonUnsafe(
          { error: "Too many requests" },
          { status: 429, headers: { ...headers, "retry-after": String(retryAfter) } },
        )
      }

      const response = yield* httpEffect
      return HttpServerResponse.setHeaders(response, headers)
    }),
  { global: true },
).layer
```

The path-prefix config table replaces the per-route `strictRateLimiter`/`relaxedRateLimiter`/`playTrackRateLimiter` factories. Per-endpoint annotations on `HttpApiEndpoint` are possible but add machinery for no behavioral gain -- the config table mirrors what the route files express today. (Spike note: confirm `request.url` shape and the exact `jsonUnsafe` signature when wiring this.)

#### 4c. Logging and tracing

Same shape: global `HttpRouter.middleware`, since it needs the response status and must cover non-API routes too.

```ts
export const RequestLoggerLive = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest
      const start = Date.now()
      const response = yield* httpEffect
      yield* Effect.logInfo(
        `${request.method} ${request.url} ${response.status} - ${Date.now() - start}ms`,
      )
      return response
    }),
  { global: true },
).layer
```

Before porting `effectLogger()` wholesale, check what comes free: `HttpRouter.toWebHandler` has a built-in request logger (`disableLogger` option), and OpenTelemetry tracing via `Effect.withSpan` continues to work in services unchanged. The current middleware's span-per-request behavior may be mostly redundant.

**Request IDs**: the current `requestId()` Hono middleware has no direct port in this plan. Effect's tracing spans provide correlation; if the `x-request-id` response header is load-bearing (log correlation on the VPS), add it in this same logger middleware via `HttpServerResponse.setHeader`.

#### 4d. CORS

```ts
import { HttpMiddleware, HttpRouter } from "effect/unstable/http"

export const CorsLive = HttpRouter.middleware(
  HttpMiddleware.cors({
    allowedOrigins: [
      "http://localhost:5173",
      "https://goosebumps.fm",
      "https://www.goosebumps.fm",
    ],
    allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "Refresh-Token"],
    exposedHeaders: ["Set-Cookie"],
    credentials: true,
  }),
  { global: true },
).layer
```

Two traps, both verified in the library:
- The option is `exposedHeaders`, not `exposeHeaders`.
- **Do not pass CORS via `HttpRouter.toWebHandler`'s `middleware` option.** Its docs state explicitly: "Changes to the response are not reflected in the final response sent to the client. Use `HttpRouter.middleware` when middleware must modify the response." CORS is response-header modification; wired through `toWebHandler` it silently does nothing.

#### 4e. Error handling / Sentry

The current `onError` captures **thrown exceptions** in Sentry. In Effect terms those are defects (unexpected errors), not the declared tagged errors -- declared errors are business as usual and are encoded to responses by the builder before global middleware sees anything.

`HttpApiMiddleware.layerSchemaErrorTransform` is **not** the hook for this: it reshapes request *validation* failures (`HttpApiSchemaError`) into custom error schemas. Useful for consistent 400 bodies, irrelevant for crash capture.

Capture defects in a global middleware:

```ts
export const SentryLive = HttpRouter.middleware(
  (httpEffect) =>
    httpEffect.pipe(
      Effect.tapDefect((defect) =>
        Effect.gen(function* () {
          const sentry = yield* SentryService
          yield* sentry.captureException(defect)
        }),
      ),
    ),
  { global: true },
).layer
```

`SentryService` comes from `AppLayer`, which is provided to the whole router (Phase 5).

### Phase 5: Server wiring

The entry point must carry over **everything** in the app.ts inventory, not just routes. Anything missing from this list is a production regression:

| Subsystem | Where it goes |
|-----------|---------------|
| HttpApi groups | `HttpApiBuilder.layer(Api)` + handler layers |
| `/doc` + Scalar UI | `HttpApiScalar.layer(Api)` (replaces `configure-open-api.ts`) |
| better-auth at `/auth/*` | wildcard route on the router (below) |
| RSS / sitemap / `/s` share pages | plain `HttpRouter` routes returning `HttpServerResponse.html/text/redirect` -- these are not JSON endpoints and should not be forced into `HttpApiEndpoint` |
| `/health/live`, `/health/ready` | health group handlers; readiness keeps its 5s cache (module-level or `Ref`) |
| CORS, rate limit, logger, Sentry | global `HttpRouter.middleware` layers (Phase 4) |
| Reminder loop + sitemap regeneration | unchanged `runAppFork(...)` at startup |
| Graceful shutdown | SIGTERM/SIGINT → `toWebHandler`'s `dispose()` then `disposeRuntime()` |
| 1GB request bodies | unchanged `maxRequestBodySize` on the Bun.serve export |

better-auth mounts as a wildcard route. Its handler is async and returns a web `Response`, so it needs `Effect.promise` and `HttpServerResponse.fromWeb` -- `Effect.succeed(auth.handler(...))` would produce an unawaited `Promise` typed as the response:

```ts
const BetterAuthRoutes = HttpRouter.use((router) =>
  router.add("*", "/auth/*", (request) =>
    Effect.promise(() =>
      auth.handler(prepareAuthRequest(HttpServerRequest.toWeb(request))),
    ).pipe(Effect.map(HttpServerResponse.fromWeb)),
  ),
)
```

Entry point sketch (`src/index.ts`):

```ts
import { Layer } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi"
import { Api } from "@gbfm/api"

const HandlersLive = Layer.mergeAll(
  MusicHandlers,
  HealthHandlers,
  // ... remaining groups
).pipe(Layer.provide(AuthMiddlewareLive))

const RoutesLive = Layer.mergeAll(
  HttpApiBuilder.layer(Api).pipe(Layer.provide(HandlersLive)),
  HttpApiScalar.layer(Api),
  BetterAuthRoutes,
  SiteRoutes,          // rss + seo + share as plain routes
  HonoFallback,        // during migration only -- see next section
)

const AppHttpLayer = RoutesLive.pipe(
  Layer.provide([CorsLive, RateLimiterLive, RequestLoggerLive, SentryLive]),
  Layer.provideMerge(AppLayer),
)

const { handler, dispose } = HttpRouter.toWebHandler(AppHttpLayer)

setupGracefulShutdown(async () => {
  await dispose()
  await disposeRuntime()
})
runAppFork(reminderLoopEffect)
runAppFork(sitemapRegenerationEffect)

export default {
  port: 3003,
  fetch: handler,
  maxRequestBodySize: 1024 * 1024 * 1000,
}
```

(Spike note: validate the global-middleware layer wiring -- `Layer.provide` vs merge -- in step 2 of the migration order before scaling to all groups.)

### Incremental migration: Hono as wildcard fallback

One server, one port, one deploy at a time. The whole existing Hono app mounts as a wildcard fallback route on the Effect router:

```ts
import honoApp from "@/app"

const HonoFallback = HttpRouter.use((router) =>
  router.add("*", "/*", (request) =>
    Effect.promise(() => honoApp.fetch(HttpServerRequest.toWeb(request))).pipe(
      Effect.map(HttpServerResponse.fromWeb),
    ),
  ),
)
```

The router (find-my-way) gives static and parametric routes precedence over the wildcard, so each `HttpApi` group added takes over its paths automatically. Per group: port endpoints + handlers, delete the corresponding Hono router from `app.ts`, deploy. When `app.ts` has no routers left, delete `HonoFallback` and the Hono dependency.

**Middleware double-application caveat**: while the fallback exists, requests hitting Hono routes pass through both the Effect global middleware and Hono's own cors/rate-limit/logger. For CORS and logging that is harmless duplication; for rate limiting it would double-count. During the transition, keep the rate limiter on the Hono side only, and add `RateLimiterLive` in the same deploy that removes the fallback. Same for Sentry: Hono's `onError` keeps covering fallback routes until the end.

This replaces any "run old and new servers side by side and flip at the end" plan -- that is a big-bang cutover wearing incremental clothes, and it blocks the client from adopting the typed client until everything is done.

### Phase 6: Client generation

The client is generated from the same `Api` definition. Two things the naive version gets wrong, both of which produce silent 401s in production:

1. **`RequestInit` must be provided to the `FetchHttpClient` layer, not the build effect.** The fetch client reads `RequestInit` from the context captured when the layer is built (`layerMergedContext`); providing it with `Effect.provideService` around `HttpApiClient.make` puts it in a context that no longer exists when requests actually run, so `credentials: "include"` silently disappears and cookies are never sent.
2. **The base URL is cross-origin in prod.** Use `VITE_VPS_BASE_URL` like the existing `apiUrl` helper does; `baseUrl: ""` only works when www and the VPS share an origin.

```ts
// apps/www/src/lib/api-client.ts
import { Api } from "@gbfm/api"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"

const FetchLive = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" }),
  ),
)

const buildClient = () =>
  HttpApiClient.make(Api, {
    baseUrl: import.meta.env.VITE_VPS_BASE_URL || window.location.origin,
  }).pipe(Effect.provide(FetchLive))

export type ApiClient = Effect.Effect.Success<ReturnType<typeof buildClient>>

let _client: ApiClient | null = null

export const getApiClient = async (): Promise<ApiClient> => {
  if (!_client) {
    _client = await Effect.runPromise(buildClient())
  }
  return _client
}
```

Verify cookie transmission end-to-end (a request to an authed endpoint from the deployed www origin) before replacing any hook -- this is the failure mode that type-checks fine and only breaks in the browser.

Usage in a component:
```ts
import { getApiClient } from "@/lib/api-client"

const { data } = useQuery({
  queryKey: ['artists'],
  queryFn: async () => {
    const client = await getApiClient()
    const result = await Effect.runPromise(client.music.listArtists({}))
    return result.items
  },
})
```

The client methods are fully typed:
```ts
client.music.listArtists({})                              // → Effect<ArtistListResponse, ...>
client.music.getArtist({ params: { id: "..." } })         // → Effect<ArtistDetailResponse, ...>
client.music.createArtist({ payload: { name: "..." } })   // → Effect<ArtistDetailResponse, ...>
```

Errors are also typed -- the client knows which tagged error schemas each endpoint can fail with.

### Phase 7: Replacing react-query hooks incrementally

The migration from hand-written hooks to the typed client can happen gradually, and can start as soon as the first group is live behind the fallback (the server serves both old and new routes throughout).

1. Define schemas and endpoints for one group (e.g., music) in `Api`
2. Implement handlers with `HttpApiBuilder.group`, deploy behind the fallback
3. Create `api-client.ts` on the client
4. Replace `useAdminArtists` with `client.music.listArtists({})`
5. Keep other hooks as-is until their groups are migrated

A compatibility adapter can help:
```ts
// lib/http-adapter.ts -- bridges old hooks to new client during migration
export const clientQuery = <T>(fetch: (client: ApiClient) => Effect.Effect<T>) =>
  async () => {
    const client = await getApiClient()
    return Effect.runPromise(fetch(client))
  }
```

Then:
```ts
// Before:
queryFn: () => fetcher(apiUrl('/music/artists'))

// After:
queryFn: clientQuery((c) => c.music.listArtists({}).pipe(Effect.map((r) => r.items)))
```

### Phase 8: Retiring the scaffolding

Once all route groups are migrated:

**Remove from `apps/vps`:**
- `hono`, `@hono/zod-openapi` dependencies
- `@scalar/hono-api-reference` dependency (replaced by `HttpApiScalar.layer`)
- `stoker` dependency
- `createRouter()`, `AppRouteHandler`, `AppOpenAPI` types
- `configure-open-api.ts`
- `effect-hono.ts` (the `runEffect` wrapper)
- All `*.routes.ts` and `*.index.ts` files (routes merged into handlers)
- The `HonoFallback` route

**Remove from `apps/www`:**
- `createFetcher` from `lib/http-client.ts`
- `apiUrl`, `apiUrlObj` from `lib/http-url.ts`
- All manually typed response interfaces in `lib/http.ts` (replaced by `Schema.Type`)
- The `reportApiFailure` wrapper (errors are typed and handled through the Effect error channel)

---

## Migration Order (recommended path)

| Step | What | Risk | Value |
|------|------|------|-------|
| 1 | Create `packages/api` with contract for health group | Low | Proves the pattern |
| 2 | Wire `HttpRouter.toWebHandler` + `HonoFallback` + better-auth route + background forks + shutdown; deploy with only health ported | Medium | The whole serving stack changes here -- validate CORS, cookies, health probes, reminders in prod |
| 3 | Port auth middleware (cookie-based) | Medium | Auth is the hardest piece; verify with an authed group |
| 4 | Port one CRUD group entirely (e.g., music artists) | Medium | Full vertical slice |
| 5 | Generate client for that group, replace one react-query hook; verify cookies cross-origin | Low | Tangible client benefit |
| 6 | Port remaining JSON groups incrementally, one deploy each | Low-Medium | Mechanical work |
| 7 | Port upload groups (multipart -- see below) and non-JSON routes (rss/seo/share) | Medium | The hairy tail |
| 8 | Move rate limiter + Sentry capture to Effect middleware, remove `HonoFallback`, delete Hono + Zod | Low | Cleanup |

Step 2 is deliberately front-loaded: it is where the serving topology changes and where step-3-through-8 assumptions get validated cheaply.

---

## What about better-auth?

Better-auth is a third-party library that owns its own routing. `auth.handler()` is an opaque async function returning a web `Response`. We can't redefine its routes as `HttpApiEndpoint`s.

It mounts as a wildcard route directly on the Effect `HttpRouter` (see Phase 5 for the correct `Effect.promise` + `HttpServerResponse.fromWeb` wrapping). It stays at root `/auth` -- the basePath appears in emailed links. The `better-auth.routes.ts` Hono wrapper gets deleted; `prepareAuthRequest` stays as a standalone function in `lib/auth.ts`.

---

## Key constraints and caveats

### Uploads and non-JSON routes (do not skip this)

The doc-shaped part of the API is JSON CRUD, but the hard 20% is:

- **`upload` + `upload-multipart`**: both Hono routers mount at `/api/upload`, so they become a *single* `HttpApi` group (endpoint names must be unique within it). The multipart flow (init/part/complete/abort/status) is mostly JSON control endpoints; the part-upload endpoint takes a raw binary body -- `HttpApiSchema.asUint8Array` or `asMultipartStream` on the payload. The 1GB `maxRequestBodySize` stays on the Bun.serve export. Budget real time here; nothing about the current Zod route translates mechanically.
- **RSS, sitemap, `/s` share pages**: HTML/XML responses and redirects. These stay plain `HttpRouter` routes (`HttpServerResponse.html`, `.text`, `.redirect`) -- forcing them into `HttpApiEndpoint` buys nothing and fights the JSON-first encoding.

### Schema gap: Zod → Effect Schema

Current route schemas use Zod. Effect `Schema` has the same expressiveness but different API (names verified against 4.0.0-beta.70):

| Concept | Zod | Effect Schema |
|---------|-----|---------------|
| String | `z.string()` | `Schema.String` |
| Number | `z.number()` | `Schema.Number` |
| Optional | `z.string().optional()` | `Schema.optional(Schema.String)` |
| Union | `z.union([...])` | `Schema.Union([...])` |
| Array | `z.array(...)` | `Schema.Array(...)` |
| Object | `z.object({...})` | `Schema.Struct({...})` |
| Nullable | `z.string().nullable()` | `Schema.NullOr(Schema.String)` |
| Enum-like | `z.enum([...])` | `Schema.Literals([...])` (`Schema.Literal` takes a single literal) |
| File/binary body | `z.instanceof(File)` etc. | `HttpApiSchema.asUint8Array` / `asMultipart` / `asMultipartStream` |

Database schemas (Drizzle Zod schemas in `@gbfm/vps/schemas`) are unaffected -- they stay as-is. The API layer defines its own response schemas that may or may not mirror DB types.

### Middleware: what can touch responses

Three tiers, easy to mix up:

1. **`HttpApiMiddleware`** (endpoint middleware): wraps the endpoint's `Effect<HttpServerResponse>` -- it *can* transform success responses (e.g., add headers) and provide services, but its failures must be schema-declared, and it only covers `HttpApi` endpoints.
2. **`HttpRouter.middleware(..., { global: true })`**: wraps every route including better-auth, RSS, and the Hono fallback; can modify responses. This is where CORS, rate limiting, logging, and Sentry live.
3. **`toWebHandler`'s `middleware` option**: wraps the server chain *including the response send* -- response modifications are silently dropped (documented gotcha). Don't put anything response-modifying here.

### Service injection

Current handlers get services through `AppRuntime.runPromise(program)`. In `HttpApiBuilder.group().handle()`, handlers run inside the Effect context and get services from the provided layers -- `AppLayer` from `runtime/services.ts` plugs in via `Layer.provideMerge` unchanged.

### Testing

`HttpApiTest.groups` provides in-memory testing of API groups through the typed client without starting a server:
```ts
import { HttpApiTest } from "effect/unstable/httpapi"

const testClient = yield* HttpApiTest.groups(Api, ["music"])
const result = yield* testClient.music.listArtists({})
```

---

## Option B: Quicker alternative -- openapi-typescript + openapi-fetch

The lower-effort path to client type safety with zero server changes:

1. `openapi-typescript` and `openapi-fetch` are already installed -- **but in `apps/vps`'s package.json**; add them to `apps/www` where the generated types and client actually live
2. Run codegen against the running server's `GET /doc` at build time (or commit a spec snapshot so codegen doesn't require a live server):
   ```bash
   bunx openapi-typescript http://localhost:3003/doc -o apps/www/src/lib/api.generated.ts
   ```
3. Use the generated types:
   ```ts
   import createClient from "openapi-fetch"
   import type { paths } from "./api.generated"

   const client = createClient<paths>({ baseUrl: import.meta.env.VITE_VPS_BASE_URL })
   const { data, error } = await client.GET("/api/music/artists", { credentials: "include" })
   ```

This adds a codegen step and types are derived from the spec (not the source of truth), but requires zero server changes. It can be adopted this week and does not conflict with migrating to Effect HttpApi later -- hooks converted to `openapi-fetch` are easier to convert again than hand-written fetches.

---

## Decision

| Factor | Option A (Effect HttpApi) | Option B (openapi-typescript) |
|--------|--------------------------|-------------------------------|
| Type safety | End-to-end, from Schema source | From generated OpenAPI types |
| Server changes | Full rewrite of route layer | None |
| Client DX | Fully typed methods with autocomplete | Typed paths/methods |
| Codegen step | None | Build-time step |
| Error typing | Schema-typed per endpoint | Union of all error responses |
| Effect integration | Native (services, errors, runtime) | None (raw fetch) |
| Stability | `unstable/` module of a beta release | Stable, boring tooling |
| Effort | 3-6 weeks (18 route groups, auth, uploads, non-JSON routes, cutover) | 1-2 days |
| Migration risk | Low-medium per group behind the Hono fallback; step 2 (serving topology) is the risky deploy | ~None |
| Maintenance | Contract lives in one place | Spec = generated artifact |

**Recommendation: staged.** Do Option B now -- it delivers the actual pain relief (typed client, no hand-written response types) for 1-2 days of work with zero production risk. Treat Option A as the destination, executed group-by-group behind the Hono fallback, starting when there's appetite for step 2's serving-topology change -- or when Effect 4 stabilizes and the `unstable/httpapi` churn risk drops. The `packages/api` contract from Option A supersedes Option B's generated types one group at a time; nothing done for B is thrown away until its group is ported.
