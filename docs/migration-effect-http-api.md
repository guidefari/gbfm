# Migration: Hono + zod-openapi → Effect HttpApi

## Why?

The VPS server (`apps/vps`) uses Hono + `@hono/zod-openapi` for route definitions. The web client (`apps/www`) has ~1400 lines of hand-written react-query hooks with manually typed fetch calls (~50+ API endpoints). There is zero shared type safety between server and client -- response types are duplicated, paths are stringly-typed, and errors are handled ad-hoc.

Effect's `unstable/httpapi` module (already in the dependency tree at `effect@4.0.0-beta.70`) provides:

- **Shared contract**: One `HttpApi` definition at the domain boundary, consumed by both server and client
- **Auto-generated type-safe client**: `HttpApiClient.make(Api)` produces a fully typed client with correct params, query, payload, response, and error types
- **Built-in OpenAPI generation**: `OpenApi.fromApi()` produces the spec directly from declarative endpoint definitions
- **Native middleware system**: Rate limiting, auth, logging, and tracing all become typed Effect middleware with schema-declared errors and service requirements
- **No codegen step**: Types flow from schemas at the type level, no build-time code generation

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
```

### Client (`apps/www`)

```
~50 react-query hooks in lib/http.ts → fetcher(apiUrl('/path')) with manual type params
                                       path strings, method strings, body serialization,
                                       response types all hand-written per hook
```

### Available Effect infrastructure

- `runtime/index.ts`: Built-once `Scope` + `Layer`, `AppRuntime.runPromise/runPromiseExit/runFork`
- `runtime/services.ts`: `Layer.mergeAll(...)` composing all domain services
- All domain services are typed as `Context.Service<X, { ... }>` -- can be injected via `Layer.provide`

---

## Option A: Full migration to Effect HttpApi (recommended)

### High-level plan

1. Define a shared API contract using `HttpApi.make()` + `HttpApiGroup` + `HttpApiEndpoint`
2. Port each Hono route definition to an `HttpApiEndpoint`
3. Convert `@hono/zod-openapi` Zod schemas to Effect `Schema` objects
4. Port route handlers from `AppRouteHandler<R>` Hono handlers to `HttpApiBuilder.group()` handlers
5. Port domain errors (currently `Data.TaggedError`) to `Schema.TaggedError` with `HttpApiSchema.status()` annotations
6. Port middleware (auth, rate limiting, logging/tracing) to `HttpApiMiddleware.Service`
7. Replace `Bun.serve` with `HttpRouter.toWebHandler()`
8. On the client, generate the typed client via `HttpApiClient.make(Api)`
9. Gradually replace react-query hooks with calls through the typed client

### Phase 1: Shared schemas and API contract (`packages/api`)

Create a new workspace package `packages/api` (or co-locate in `apps/vps/src/api/`) that defines the public API contract.

```ts
// packages/api/src/api.ts  (or  apps/vps/src/api/api.ts)
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"

// ── Response schemas ──────────────────────────────────────────
export const HealthResponse = Schema.Struct({ ok: Schema.Literal(true) })

export const NotFoundError = HttpApiSchema.status(404)(
  Schema.Struct({ error: Schema.String })
)
export const BadRequestError = HttpApiSchema.status(400)(
  Schema.Struct({ error: Schema.String })
)
export const InternalServerError = HttpApiSchema.status(500)(
  Schema.Struct({ error: Schema.String })
)

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
    error: InternalServerError,
  }),
)

export const MusicGroup = HttpApiGroup.make("music").add(
  HttpApiEndpoint.get("listArtists", "/api/music/artists", {
    success: ArtistListResponse,
    error: InternalServerError,
  }),
  HttpApiEndpoint.get("getArtist", "/api/music/artists/:id", {
    params: { id: Schema.String },
    success: ArtistDetailResponse,
    error: Schema.Union([NotFoundError, InternalServerError]),
  }),
  HttpApiEndpoint.post("createArtist", "/api/music/artists", {
    payload: CreateArtistInput,
    success: ArtistDetailResponse,
    error: Schema.Union([BadRequestError, InternalServerError]),
  }),
)

// ── Composed API ──────────────────────────────────────────────
export const Api = HttpApi.make("gbfm")
  .add(HealthGroup)
  .add(MusicGroup)
```

**Key changes from current pattern:**
- `@hono/zod-openapi` `createRoute({ path, method, request: { params, query, body }, responses })` → `HttpApiEndpoint.get/post( name, path, { params, query, payload, success, error })`
- `ContentfulStatusCode` keys → `HttpApiSchema.status(n)` annotated schemas
- Zod schemas → Effect `Schema` objects (same concepts, different import)
- `jsonContent(schema, desc)` in responses → direct `success`/`error` schema fields

### Phase 2: Port domain errors

Current errors like `NotFoundError` use `Data.TaggedError` which are opaque classes not connected to the schema system.

```ts
// Current:
export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly message: string
  readonly resource?: string
}> {}

// New:
export const NotFoundError = HttpApiSchema.status(404)(
  Schema.Struct({
    error: Schema.String,
    resource: Schema.optional(Schema.String),
  }),
)
```

Where an Effect service needs to produce these, create schema-tagged error classes:

```ts
export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
  "NotFoundError",
  {
    error: Schema.String,
    resource: Schema.optional(Schema.String),
  },
) {
  static readonly annotations = HttpApiSchema.status(404)(NotFoundError)
}
```

This preserves the tagged error pattern (`yield* Effect.fail(new NotFoundError({ error: "..." }))`) while making them encodable by the HTTP API layer.

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
// routes/music.handlers.ts
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
        if (!artist) return yield* Effect.fail({ error: "Artist not found" })
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

Handlers receive `{ params, query, payload, headers, request }` based on the endpoint schemas -- fully typed with no manual extraction. The `runEffect` wrapper is no longer needed; the HTTP API builder handles encoding and error responses automatically.

### Phase 4: Port middleware

#### 4a. Auth middleware

Current `betterAuthMiddleware` is a Hono middleware that calls `auth.api.getSession()` and sets `c.set('user', ...)`.

In Effect HttpApi, auth becomes a **security middleware**:

```ts
// packages/api/src/middleware/auth.ts
import { Schema } from "effect"
import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi"

// 1. Define the services this middleware provides to handlers
export class AuthSession {
  constructor(
    readonly user: { id: string; name: string; email: string; role: string },
    readonly session: { id: string },
  ) {}
}

// 2. Define the middleware service with a bearer token security scheme
export class AuthMiddleware extends HttpApiMiddleware.Service<AuthMiddleware>()(
  "api/AuthMiddleware",
  {
    security: {
      bearer: HttpApiSecurity.bearer,
    },
    provides: AuthSession,
  },
) {}
```

Server-side implementation:
```ts
// apps/vps/src/middleware/auth.impl.ts
import { Effect, Layer } from "effect"
import { auth } from "@/lib/auth"

export const AuthMiddlewareLive = Layer.succeed(
  AuthMiddleware,
  {
    bearer: (httpEffect, { credential }) =>
      Effect.gen(function* () {
        const session = yield* Effect.tryPromise({
          try: () => auth.api.getSession({ headers: { authorization: `Bearer ${credential.value}` } }),
        })
        if (!session) {
          return yield* Effect.fail({ error: "Unauthorized" })
        }
        return yield* Effect.provideService(
          httpEffect,
          AuthSession,
          new AuthSession(session.user, session.session),
        )
      }),
  },
)
```

Attach to a group or API:
```ts
const Api = HttpApi.make("gbfm")
  .add(AdminGroup.middleware(AuthMiddleware))
```

Admin-only endpoints can use a separate middleware or the handler can check `yield* AuthSession` and fail on non-admin roles.

Alternatively, for the simpler "attach session if present" pattern (current `attachSessionMiddleware`), a non-security middleware that makes the session optional:
```ts
export class SessionMiddleware extends HttpApiMiddleware.Service<SessionMiddleware>()(
  "api/SessionMiddleware",
  {
    provides: AuthSession.optional, // custom optional service wrapper
  },
) {}
```

The custom `optional` pattern would use `Effect.catchAll` to swallow the missing service and provide a null session.

#### 4b. Rate limiting middleware

Current `InMemoryRateLimiter` is a class-based Hono middleware with configurable windows/limits.

In Effect HttpApi, rate limiting becomes a non-security middleware:

```ts
// packages/api/src/middleware/rate-limiter.ts
import { Schema } from "effect"
import { HttpApiMiddleware } from "effect/unstable/httpapi"

export class RateLimitError extends Schema.TaggedErrorClass<RateLimitError>()(
  "RateLimitError",
  { error: Schema.String, retryAfter: Schema.Number },
) {}

export class RateLimiter extends HttpApiMiddleware.Service<RateLimiter>()(
  "api/RateLimiter",
  {
    error: RateLimitError,
  },
) {}
```

Server-side implementation with the existing `InMemoryRateLimiter`:
```ts
// apps/vps/src/middleware/rate-limiter.impl.ts
import { Effect, Layer } from "effect"
import { getClientKey, limiter } from "./rate-limiter"

export const RateLimiterLive = Layer.succeed(
  RateLimiter,
  (httpEffect, { endpoint }) => {
    const config = endpoint.annotations // read config from endpoint annotations
    const windowMs = config.windowMs ?? 60_000
    const maxRequests = config.maxRequests ?? 60

    return Effect.gen(function* () {
      const request = yield* HttpServerRequest
      const key = `${request.url.pathname}:${getClientKey(request)}`
      const result = limiter.check(key, { windowMs, maxRequests })

      if (!result.allowed) {
        return yield* Effect.fail({
          error: "Too many requests",
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        })
      }

      // Set rate limit headers on the response
      // This needs to hook into the response -- may require response middleware
      return yield* httpEffect
    })
  },
)
```

Rate limit configs can be per-endpoint annotations:
```ts
const config = endpoint.annotations.pipe(Context.get(RateLimitConfig))
```

The global `standardRateLimiter` (60 req/min) is applied at the API level:
```ts
const Api = HttpApi.make("gbfm")
  .middleware(RateLimiter) // applies to all groups
```

Then per-endpoint configs use stricter limits via endpoint `annotate`:
```ts
HttpApiEndpoint.get("playTrack", "/tracks/:id/play", {
  ...
}).annotate(RateLimitConfig, { windowMs: 60_000, maxRequests: 5 })
```

If setting rate limit headers on responses requires response-level middleware (not yet supported in the current API), use `HttpMiddleware` from `effect/unstable/http` instead of `HttpApiMiddleware`. It wraps the entire response pipeline and can modify response headers.

#### 4c. Logging and tracing

The current `effectLogger()` middleware uses OpenTelemetry spans and Effect logging. In the HttpApi world, this becomes a non-security middleware:

```ts
export class RequestLogger extends HttpApiMiddleware.Service<RequestLogger>()(
  "api/RequestLogger",
) {}
```

Implementation:
```ts
export const RequestLoggerLive = Layer.succeed(
  RequestLogger,
  (httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest
      const start = Date.now()
      yield* Effect.logInfo(`${request.method} ${request.url.pathname}`)

      return yield* httpEffect.pipe(
        Effect.tap((response) =>
          Effect.logInfo(`${request.method} ${request.url.pathname} ${response.status} - ${Date.now() - start}ms`)
        ),
        Effect.tapError((error) =>
          Effect.logError(`${request.method} ${request.url.pathname} failed: ${error}`)
        ),
      )
    }),
)
```

OpenTelemetry tracing is built into Effect (via `Effect.withSpan`), so service-level spans continue to work transparently. The HTTP router may handle its own tracing automatically (check `HttpRouter.toWebHandler` options).

#### 4d. CORS

CORS is handled at the `HttpRouter` level, not as endpoint middleware:

```ts
import { HttpMiddleware } from "effect/unstable/http"

const CorsMiddleware = HttpMiddleware.cors({
  allowedOrigins: [
    "http://localhost:5173",
    "https://goosebumps.fm",
    "https://www.goosebumps.fm",
  ],
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "Refresh-Token"],
  exposeHeaders: ["Set-Cookie"],
  credentials: true,
})

const { handler } = HttpRouter.toWebHandler(AppLayer, {
  middleware: CorsMiddleware,
})
```

#### 4e. Error handling / Sentry

The current `onError` captures exceptions in Sentry via `SentryService`. This becomes an `HttpApiBuilder` schema error transform or a final middleware:

```ts
export const SentryErrorHandler = HttpApiMiddleware.layerSchemaErrorTransform(
  SentryMiddleware,
  (schemaError, { endpoint, group }) =>
    Effect.gen(function* () {
      const sentry = yield* SentryService
      yield* sentry.captureException(schemaError, {
        path: endpoint.path,
        method: endpoint.method,
      })
      return yield* Effect.fail(schemaError)
    }),
)
```

### Phase 5: Server wiring

Replace the current app entry point. Everything runs through a single `HttpRouter` -- no Hono at any point. Better-auth is mounted as an opaque wildcard route. During the gradual migration, non-migrated Hono routers are mounted as raw `HttpRouter` routes until their groups are ported.

**Final state** (`src/index.ts`):
```ts
import { Effect, Layer } from "effect"
import { HttpRouter, HttpMiddleware } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "./api"
import { MusicHandlers } from "./routes/music.handlers"
import { AppLayer } from "./runtime/services"
import { auth, prepareAuthRequest } from "./lib/auth"

const ApiHandlersLayer = Layer.mergeAll(
  AuthMiddlewareLive,
  RateLimiterLive,
  RequestLoggerLive,
  MusicHandlers,
  // ... remaining groups
)

const CorsMiddleware = HttpMiddleware.cors({
  allowedOrigins: [
    "http://127.0.0.1:5173",
    "https://goosebumps.fm",
    "https://www.goosebumps.fm",
  ],
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "Refresh-Token"],
  exposeHeaders: ["Set-Cookie"],
  credentials: true,
})

const ServerLayer = Layer.mergeAll(
  HttpApiBuilder.layer(Api).pipe(Layer.provide(ApiHandlersLayer)),
  // Mount better-auth as an opaque wildcard route on the same router
  HttpRouter.use((router) =>
    router.add("*", "/auth/*", (request) =>
      Effect.succeed(auth.handler(prepareAuthRequest(request.raw)))
    )
  ),
).pipe(Layer.provideMerge(AppLayer))

const { handler } = HttpRouter.toWebHandler(ServerLayer, {
  middleware: CorsMiddleware,
})

export default {
  port: 3003,
  fetch: handler,
  maxRequestBodySize: 1024 * 1024 * 1000,
}
```

The `AppLayer` from `runtime/services.ts` composes all domain service implementations -- it plugs in unchanged.

**During migration** -- existing Hono routers mount alongside the new HttpApi groups:

```ts
const ServerLayer = Layer.mergeAll(
  // New HttpApi groups -- gradually replacing Hono routers
  HttpApiBuilder.layer(Api).pipe(Layer.provide(ApiHandlersLayer)),
  // Raw routes for non-migrated Hono routers, still using their existing handlers
  HttpRouter.use((router) => {
    // Mount the entire Hono app as a wildcard route
    nonMigratedRouter.fetch // ← no. Hono must go.
  }),
  // Better-auth wildcard
  HttpRouter.use((router) =>
    router.add("*", "/auth/*", (request) =>
      Effect.succeed(auth.handler(prepareAuthRequest(request.raw)))
    )
  ),
)
```

To avoid bifurcating the routing table into Effect groups + raw Hono-wrapped routes during migration, **port groups one at a time and only deploy when a group is fully moved**. Each group is independent, so the deployment boundary is clean. The old Hono server stays running until all groups are ported; then you flip the switch.

### Phase 6: Client generation

On the client side, the API client is generated from the same `Api` definition:

```ts
// apps/www/src/lib/api-client.ts
import { Api } from "@gbfm/vps/api"
import { Effect } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"

export type ApiClient = HttpApiClient.ForApi<typeof Api>

let _client: ApiClient | null = null

const buildClient = () =>
  HttpApiClient.make(Api, {
    baseUrl: "", // same-origin in dev; configure per environment
  }).pipe(
    Effect.provideService(FetchHttpClient.RequestInit, {
      credentials: "include",
    }),
    Effect.provide(FetchHttpClient.layer),
  )

export const getApiClient = async (): Promise<ApiClient> => {
  if (!_client) {
    _client = await Effect.runPromise(buildClient())
  }
  return _client
}
```

Usage in a component:
```ts
import { getApiClient } from "@/lib/api-client"

// In a react-query hook:
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
client.music.listArtists({})                                    // → Effect<ArtistListResponse, ...>
client.music.getArtist({ params: { id: "..." } })               // → Effect<ArtistDetailResponse, ...>
client.music.createArtist({ payload: { name: "..." } })         // → Effect<ArtistDetailResponse, ...>
```

Errors are also typed -- the client knows which error schemas each endpoint can fail with.

### Phase 7: Replacing react-query hooks incrementally

The migration from hand-written hooks to the typed client can happen gradually. Start with a single route group (e.g., music) as a proof of concept:

1. Define schemas and endpoints for music in `Api`
2. Implement handlers with `HttpApiBuilder.group`
3. Create `api-client.ts` on the client
4. Replace `useAdminArtists` hook with `client.music.listArtists({})`
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
- `@hono/zod-openapi` dependency
- `@scalar/hono-api-reference` dependency
- `stoker` dependency
- `createRouter()`, `AppRouteHandler`, `AppOpenAPI` types
- `configure-open-api.ts`
- `effect-hono.ts` (the `runEffect` wrapper)
- All `*.routes.ts` and `*.index.ts` files (routes merged into handlers)

**Remove from `apps/www`:**
- `createFetcher` from `lib/http-client.ts`
- `apiUrl`, `apiUrlObj` from `lib/http-url.ts`
- All manually typed response interfaces in `lib/http.ts` (replaced by generated `Schema.Type`)
- The `reportApiFailure` wrapper (errors are typed and handled through the Effect error channel)

---

## Migration Order (recommended path)

| Step | What | Risk | Value |
|------|------|------|-------|
| 1 | Create shared schemas + API contract for one group (e.g., health) | Low | Proves the pattern |
| 2 | Port health endpoint to `HttpApiBuilder.group` | Low | Validates server wiring |
| 3 | Set up `HttpRouter.toWebHandler` + better-auth route | Medium | Single entry point |
| 4 | Port auth middleware to `HttpApiMiddleware` with security | Medium | Auth is the hardest piece |
| 5 | Port rate limiting middleware | Medium | Understands middleware constraints |
| 6 | Port one CRUD group entirely (e.g., music artists) | Medium | Full vertical slice |
| 7 | Generate client for that group, replace one react-query hook | Low | Tangible client benefit |
| 8 | Port remaining groups incrementally | Low-Medium | Mechanical work |
| 9 | Remove Hono + Zod dependencies, delete old route files | Low | Cleanup |

---

## What about better-auth?

Better-auth is a third-party library that owns its own routing. `auth.handler()` is an opaque function that returns a `Response`. We can't redefine its routes as `HttpApiEndpoint`s.

It mounts as a wildcard route directly on the Effect `HttpRouter` -- no Hono wrapper, no separate server:

```ts
HttpRouter.use((router) =>
  router.add("*", "/auth/*", (request) =>
    Effect.succeed(auth.handler(prepareAuthRequest(request.raw)))
  )
)
```

The `better-auth.routes.ts` Hono wrapper gets deleted entirely. The `prepareAuthRequest` logic moves into the Effect handler or stays as a standalone function in `lib/auth.ts`.

---

## Key constraints and caveats

### Schema gap: Zod → Effect Schema

Current route schemas use Zod. Effect `Schema` has the same expressiveness but different API:

| Concept | Zod | Effect Schema |
|---------|-----|---------------|
| String | `z.string()` | `Schema.String` |
| Number | `z.number()` | `Schema.Number` |
| Optional | `z.string().optional()` | `Schema.optional(Schema.String)` |
| Union | `z.union([...])` | `Schema.Union([...])` |
| Array | `z.array(...)` | `Schema.Array(...)` |
| Object | `z.object({...})` | `Schema.Struct({...})` |
| Nullable | `z.string().nullable()` | `Schema.nullable(Schema.String)` |
| Enum-like | `z.enum([...])` | `Schema.Literal(...)` |

Database schemas (Drizzle Zod schemas in `@gbfm/vps/schemas`) are unaffected -- they stay as-is. The API layer defines its own response schemas that may or may not mirror DB types.

### Middleware: response header modification

Rate limiting and CORS set response headers. The current `HttpApiMiddleware` signature wraps the endpoint effect but doesn't provide direct access to set response headers. Two options:
1. **Response middleware**: Effect's `HttpMiddleware` (from `effect/unstable/http`) can wrap the entire response pipeline
2. **Response schema annotations**: Annotate endpoints with metadata, and the handler returns a response object that includes the headers

For rate limiting specifically, the cleanest approach may be to use `HttpMiddleware` for header-only transformations and `HttpApiMiddleware` for business logic.

### Service injection

Current handlers get services through `AppRuntime.runPromise(program)` which provides the full service context. In `HttpApiBuilder.group().handle()`, handlers run inside the Effect context and have access to all services provided by the merged layers -- no change needed, just ensure all services are provided to the final `AppLayer`.

### Testing

`HttpApiTest` provides in-memory testing of API groups through the typed client without starting a server:
```ts
import { HttpApiTest } from "effect/unstable/httpapi"

const testClient = yield* HttpApiTest.make(Api, { groups: ["music"] })
const result = yield* testClient.music.listArtists({})
```

---

## Option B: Quicker alternative -- openapi-typescript + openapi-fetch

If the full migration is too much for now, the lower-effort path:

1. `openapi-typescript` is already in devDeps, `openapi-fetch` is already a dep
2. Run codegen against `GET /doc` at build time:
   ```bash
   npx openapi-typescript https://localhost:3003/doc -o apps/www/src/lib/api.generated.ts
   ```
3. Use the generated types:
   ```ts
   import createClient from "openapi-fetch"
   import type { paths } from "./api.generated"

   const client = createClient<paths>({ baseUrl: "" })
   const { data, error } = await client.GET("/api/music/artists", {})
   ```

This adds a codegen step and types are derived from the spec (not the source of truth), but requires zero server changes. You can adopt it immediately and migrate to Effect HttpApi later.

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
| Effort | 2-4 weeks for full migration | 1-2 days |
| Migration risk | Medium (port per group, flip switch) | None |
| Maintenance | Contract lives in one place | Spec = generated artifact |
