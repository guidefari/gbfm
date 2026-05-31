# Zod → Effect Schema + Effect HttpApi Migration

## Goal

Remove Zod entirely from `apps/vps`. Replace with:

- **Effect Schema** for validation
- **Effect HttpApi** for typed route definitions + OpenAPI spec generation
- **openapi-fetch** for a typed client derived from that spec, shared across web/mobile/Raycast

---

## Proposed Architecture

```
Effect HttpApi definition (pure schemas + endpoint shapes)
         │
         ├─► OpenApi.fromApi(AppApi) ──► openapi-typescript ──► schema.ts
         │                                       │
         │                               openapi-fetch client (web/mobile/raycast)
         │
         └─► HttpApiBuilder.toWebHandler(AppApiLive)
                    │
                    ▼
              Hono: app.all('/api/*', handler)   ← Hono stays for auth, middleware, RSS, etc.
```

`OpenApi.fromApi(AppApi)` gives the raw spec object directly — no HTTP request needed. Feed it to `openapiTS()` in a build script → `schema.ts` → `createClient<paths>()`.

### How `toWebHandler` mounts into Hono

```typescript
import { HttpApiBuilder } from '@effect/platform'
import { HttpServer } from '@effect/platform'

const { handler, dispose } = HttpApiBuilder.toWebHandler(
  Layer.mergeAll(AppApiLive, HttpServer.layerContext)
)

app.all('/api/*', (c) => handler(c.req.raw))
process.on('SIGTERM', dispose)
```

Hono keeps: auth routes (better-auth), RSS, SEO/sitemap, redirects, static serving.

---

## Current State

| Layer         | Current                                                  | Pain                                                                    |
| ------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| API framework | `OpenAPIHono` + `@hono/zod-openapi`                      | Zod dep, tight coupling of schema+route                                 |
| Schemas       | Zod (in DB schema files, re-exported)                    | Mixed Drizzle + Zod in same files                                       |
| Client gen    | Scalar UI at `/reference`, manual `fetcher()` in www     | No typed client — `http.ts` is 800+ lines of hand-rolled fetch wrappers |
| OpenAPI spec  | Auto from `@hono/zod-openapi`                            | Path param colon→brace hack needed                                      |
| Clients       | www: manual fetch. Raycast: `api-client.ts`. Mobile: TBD | All untyped, duplicated                                                 |

---

## Migration Phases

### Phase 1 — Add Effect Schema alongside Zod (no breakage)

- Add `effect/Schema` types to DB schema files alongside existing Zod schemas
- Pattern: `export class MusicArtist extends Schema.Class<MusicArtist>("MusicArtist")({...})` mirrors Drizzle column types manually
- No existing behaviour changes

### Phase 2 — Define Effect HttpApi for one route group (music)

- Create `src/api/music.api.ts` — pure `HttpApiGroup` + `HttpApiEndpoint` definitions using Effect Schema
- Create `src/api/app.api.ts` — combines all groups into `AppApi`
- Wire `HttpApiBuilder.toWebHandler` → mount at `/api/*` in Hono
- Keep old Hono routes alive in parallel — zero breakage

### Phase 3 — Generate typed client

- Add `scripts/generate-api-client.ts` (reference: `accountability/packages/web/scripts/generate-api-client.ts`)
- `OpenApi.fromApi(AppApi)` → `openapiTS()` → `src/api/schema.ts`
- `createClient<paths>({ baseUrl: VPS_BASE_URL, credentials: 'include' })`
- Add `bun run generate:api-client` to dev/build scripts
- Replace `http.ts` fetcher functions one-by-one with `client.GET(...)` / `client.POST(...)`

### Phase 4 — Delete Zod

- Remove `@hono/zod-openapi`, `@hono/zod-validator`, `stoker`
- Remove `src/lib/zod-utils.ts`, update `create-app.ts` to use plain `Hono` instead of `OpenAPIHono`
- Scalar `/reference` stays — serve `OpenApi.fromApi(AppApi)` at `/doc`

---

## Packages

```bash
# already have: effect, @effect/platform, @effect/platform-bun
bun add openapi-fetch
bun add -d openapi-typescript
```

`@hono/zod-openapi` and `@hono/zod-validator` deleted at Phase 4.

**Do NOT add `@effect/sql-pg`** — VPS uses Drizzle + plain `pg` Pool. `@effect/sql-pg` is Effect's own SQL client, irrelevant here.

---

## Multi-Client Story

| Client      | Approach                                                                                |
| ----------- | --------------------------------------------------------------------------------------- |
| www         | `openapi-fetch` replaces `http.ts` — same `credentials: 'include'`, same base URL       |
| Raycast     | `openapi-fetch` with `Authorization: Bearer` header middleware replaces `api-client.ts` |
| Mobile (RN) | `openapi-fetch` works — RN has native fetch since 0.72                                  |
| Scalar UI   | Still served at `/reference`, pointed at `/doc` (now from `OpenApi.fromApi`)            |

---

## Risks / Tradeoffs

| Risk                                               | Mitigation                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| Effect HttpApi doesn't support all Hono middleware | Keep Hono as outer layer; Effect HttpApi only handles typed routes |
| `toWebHandler` path matching vs Hono routing       | Mount at `/api/*` prefix; strip prefix in handler if needed        |
| better-auth integration                            | Stays in Hono — don't touch                                        |
| OpenAPI spec format (Scalar path params)           | `OpenApi.fromApi` emits `{param}` natively — no colon→brace hack   |
| Bundle size for mobile                             | `openapi-fetch` is ~6KB, zero runtime schema overhead              |

---

## Test Infrastructure (completed)

Integration tests use `@testcontainers/postgresql` + real Postgres — no mocks.

Key files in `apps/vps/`:

- `src/test/global-setup.ts` — starts Postgres container, runs `drizzle-kit push`, seeds lookup tables (`music_entity_types`, `music_platforms`), sets `DB_*` and `SST_RESOURCES_JSON` env vars
- `src/test/setup.ts` — intentionally empty (no `vi.mock`)
- `vitest.config.ts` — `pool: 'forks'`, `globalSetup`, `hookTimeout: 120_000`
- `src/routes/music/music.integration.test.ts` — 91 tests covering GET/POST/404 for artists, albums, tracks, playlists, links

### Constraints enforced

| Decision                             | Reason                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| No `vi.mock()`                       | Use Effect layers or real infrastructure                                                         |
| SST via `SST_RESOURCES_JSON` env var | SST reads this natively on first `Resource` access — no mocking the SST module                   |
| Stage-based SSL via lookup object    | `test` → `false`, `prod` → `true`, else `{ rejectUnauthorized: false }`                          |
| `pool: 'forks'` (no `singleFork`)    | `singleFork` removed in vitest 4.x; env vars set in global-setup are inherited by forked workers |
| No `as any` or type assertions       | Full type safety required                                                                        |

---

## Service Architecture Changes (completed)

### DatabaseService extracted

`src/services/database.service.ts` — holds `DatabaseService` interface, `Context.Service` tag, `DatabaseServiceLive` layer. Extracted from `runtime/services.ts` to avoid a circular dep: `runtime/services.ts` → `MusicEntityServiceLive` → `DatabaseService`.

### MusicEntityService decoupled from module-level `db`

All effect functions use a **curried `db` parameter**:

```ts
const getArtistByIdEffect = (db: typeof DbType) => (id: string) => Effect.gen(...)
```

Layer factory yields `DatabaseService` once and closes over `db`:

```ts
export const MusicEntityServiceLive = Layer.effect(
  MusicEntityService,
  Effect.gen(function* () {
    const { db } = yield* DatabaseService  // once here
    return {
      getArtistById: getArtistByIdEffect(db),  // closed over
      ...
    } satisfies MusicEntityService
  })
)
```

**Why not `yield* DatabaseService` inside each function?** That changes the `R` type of each method from `never` to `DatabaseService`, breaking the `satisfies MusicEntityService` check. Curried pattern keeps `R = never` on all methods.

### music-entity.service.ts split into a module

The 2400-line monolith lives at `src/services/music-entity/`:

```
shared.ts               — DrizzleTransaction, requireOne, requireInserted,
                          deleteLinksForEntityTx, findEntityIdBySpotifyUrlTx,
                          uniqueSlug, FetchError, ImportedTrackTarget
artist.service.ts       — CRUD + findOrCreateArtist, findOrCreateArtistsByName
album.service.ts        — CRUD + addArtistToAlbum, removeArtistFromAlbum
track.service.ts        — CRUD + addArtistToTrack, removeArtistFromTrack
playlist.service.ts     — CRUD
playlist-tracks.service.ts  — getPlaylistTracks, addTrack, removeTrack, reorder,
                              addSpotifyTrackToPlaylist, importSpotifyPlaylist,
                              syncPlaylistLinks, enrichment helpers
link.service.ts         — getLinksForEntity, addLink, updateLinkStatus,
                          deleteLink, getPendingLinks
scrape.service.ts       — scrapeAndCreateEntity, findExistingEntityByUrl, getEntityById
index.ts                — MusicEntityService interface + Context.Service tag
                          + MusicEntityServiceLive layer
```

---

## References

- [Effect platform README](https://github.com/Effect-TS/effect/blob/main/packages/platform/README.md)
- [HttpApiBuilder.ts API reference](https://effect-ts.github.io/effect/platform/HttpApiBuilder.ts.html)
- [openapi-fetch docs](https://openapi-ts.dev/openapi-fetch/)
- Accountability repo: `packages/web/scripts/generate-api-client.ts` (reference for client gen script)
- [Effect platform-node examples/api.ts](https://github.com/Effect-TS/effect/blob/main/packages/platform-node/examples/api.ts)
