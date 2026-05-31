# goosebumps.fm — Performance Analysis & Recommendations

_Session: May 2026 · Branch: `claude/website-perf-profiling-GIyef` · PR: #111_

---

## Context

goosebumps.fm is a React SPA (Vite + TanStack Router) served from CloudFront, backed by a Hono API running on AWS ECS Spot instances behind API Gateway V2. There is no SSR or pre-rendering. The first-load pipeline is:

```
CloudFront → JS bundle download → parse/execute → API fetch
          (API Gateway → VPC → ECS Spot) → render
```

The complaint was that first load "always feels bad" and two specific pages — `/mixes` (home mixes) and `/editorial` — were noticeably slow.

Observability already in place: Sentry (100% trace sampling), OpenTelemetry with Jaeger, and a `query-timer.ts` that logs slow queries at 100 ms and 500 ms thresholds.

---

## What Was Done (PR #111)

All items in this section are **shipped and pushed**.

### 1. Eliminated double API call on `/mixes` and `/editorial`

**Problem:** Both pages fired a second full `useAudioByType` / `useEditorialPosts` fetch just to extract unique tag strings for the filter dropdown. On the mixes page this loaded potentially hundreds of items into memory to produce a `string[]`.

**Fix:**

- Added `GET /content/audio/{type}/tags` → `string[]` endpoint
- Added `GET /content/posts/editorials/tags` → `string[]` endpoint
- Added `useAudioTags(type)` and `useEditorialTags()` React Query hooks with 1-hour `staleTime`
- Both pages now call the dedicated hook instead of doing client-side extraction from the full list

**Files changed:** `content.routes.ts`, `content.handlers.ts`, `content.index.ts`, `apps/www/src/lib/http.ts`, `mixes/index.tsx`, `editorial/index.tsx`

### 2. Fixed N+1 creator queries in the editorial/posts list

**Problem:** `getAllEffect` in `post.service.ts` called `buildPostWithCreators(post)` for each post individually, running one `SELECT … FROM post_creators WHERE post_id = ?` per row (5 at a time via Effect concurrency). A page of 20 posts = 20 extra queries.

**Fix:** Batch-fetch all creators for the current page in a single `inArray` query (the same pattern already used in `audio.service.ts`):

```typescript
const creatorsData = postIds.length > 0
  ? yield* db.select(...).from(postCreators)
      .innerJoin(usersTable, ...)
      .where(inArray(postCreators.postId, postIds))
  : []
// build creatorsByPostId map, then buildPostWithPreloadedCreators per post
```

**Files changed:** `post.service.ts`

### 3. Replaced hand-rolled MDX cache with Effect.Cache

**Problem:** The original `compileMDX` used a plain `Map<string, string>` with no capacity bound, no TTL, no deduplication for concurrent requests to the same key, and failures were silently dropped (no retry).

**Fix:** Full rewrite of `apps/vps/src/lib/mdx.ts` using Effect's `Cache` primitive:

- Content-addressed keys (SHA-256 of the MDX string) — editing a post naturally routes to a new key
- Capacity: 256 entries (LRU eviction)
- TTL: 1 hour on successes, **zero on failures** (transient compile errors are retried immediately)
- Concurrent requests for the same content deduplicate to a single lookup
- `MdxService` is a proper Effect `Context.Service` — `AudioServiceLive` and `PostServiceLive` depend on it via `Layer.effect` + `Layer.provide(MdxServiceLive)`
- `makeMdxServiceTest(fn)` factory creates an isolated per-test cache
- `compileMDX` async shim preserved for show/label/release/resolve services (backed by the same cache primitive, no injection required)

**Files changed:** `mdx.ts`, `audio.service.ts`, `post.service.ts`, `runtime/services.ts`

**Tests added:** `src/lib/mdx.test.ts` — 10 tests covering cache hit, cache miss, concurrent deduplication, failure-not-cached, `invalidateAll`, and per-test cache isolation. Run with `bun run test:unit` (no Docker required).

### 4. Added missing database indexes

**Problem:** List queries on `/mixes` and `/editorial` hit `audio` and `posts` tables without indexes on the `(type, draft, createdAt)` composite or the `tags` array column (used by `arrayContains` / `unnest`).

**Fix:** Added via Drizzle schema (migration pending — see below):

```typescript
// audio.schema.ts
index('audio_type_draft_created_idx').on(table.type, table.draft, table.createdAt)
index('audio_tags_gin_idx').using('gin', table.tags)

// post.schema.ts
index('posts_type_draft_created_idx').on(table.type, table.draft, table.createdAt)
index('posts_tags_gin_idx').using('gin', table.tags)
```

> **Action required:** Run `bun run db:gen` then `db_pushProd` SST dev command to apply to production.

### 5. Added HTTP caching headers to content list endpoints

**Problem:** No `Cache-Control` headers on API responses, so Cloudflare could not cache them at the edge. Every request reached API Gateway → VPC → ECS.

**Fix:**

- List endpoints (`GET /audio/{type}`, `GET /posts/editorials`): `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- Tags endpoints (`GET /audio/{type}/tags`, `GET /posts/editorials/tags`): `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`

**Files changed:** `content.handlers.ts`

---

## Remaining Recommendations (Not Yet Done)

### R1 — Run the Drizzle migration in production

The index definitions are in the schema files but haven't been pushed to the production database.

```bash
bun run db:gen          # generate migration SQL
# then via SST:
sst shell --stage=prod bun run src/migrate.ts
# or use the db_pushProd dev command in your SST dev session
```

Expected impact: query planner uses the composite index on `(type, draft, createdAt)` instead of a full table scan. The GIN index on `tags` makes `arrayContains` and `unnest` O(log n) instead of sequential.

---

### R2 — Drop Sentry trace sampling from 1.0 to 0.2 in production

**File:** `apps/vps/src/instrument.ts`

```typescript
tracesSampleRate: 1.0 // ← currently 100%
```

At scale, 100% sampling adds latency overhead on every request (serialising spans, network egress to Sentry). Once baseline numbers are captured, drop to `0.2`. You'll still have statistically valid P50/P95 data. Change when you're confident in the baseline; leaving it at 1.0 during active profiling is fine.

---

### R3 — ECS Spot capacity strategy

**File:** `infra/vps.ts:57`

```typescript
capacity: 'spot' // currently pure Spot
```

Pure Spot means a single Spot interruption takes the entire API offline until ECS reschedules (typically 60–120 s). This shows up in Sentry as spikes of 502 errors.

**Recommendation:** Mixed capacity — 1 On-Demand task as a baseline + Spot for burst. In SST / ECS this requires a custom capacity provider with `onDemandBaseCapacity: 1`. This is a moderate infrastructure change; worth doing if Sentry shows regular 502 spikes correlating with Spot reclamations.

> **Constraint noted:** NAT gateway is intentionally disabled and should not be touched.

---

### R4 — First-load waterfall: consider route-level prefetching

The SPA architecture means first paint always waits for:

1. CloudFront → `index.html` + JS bundle (fast, CDN)
2. React bootstrap (fast, Bun-built + code-split)
3. API call completes (this is where latency lives)

Items 1–5 above reduce API latency. For further first-load improvement, in priority order:

**a) Cloudflare edge caching (already unblocked by item 5 above)**
Once `Cache-Control` headers are in place, Cloudflare automatically caches list responses. A returning visitor's mixes page load becomes: CloudFront → JS bundle → Cloudflare edge hit → render. No ECS round-trip.

**b) `<link rel="prefetch">` hints for API URLs in `index.html`**
TanStack Router already has `defaultPreload: 'intent'`. Going further: add `<link rel="prefetch" href="https://api.goosebumps.fm/content/audio/mix">` in the HTML `<head>`. The browser fetches it speculatively while JS is parsing.

**c) SSR / streaming (longer-term)**
SST supports Lambda streaming + React Server Components. This would let the server send HTML with data inlined, eliminating the client-side waterfall entirely. Large architectural change; not recommended until other items are exhausted.

---

### R5 — Verify Sentry traces for API span breakdown

Now that the codebase has OTEL + Sentry wired at 100% sampling, pull a slow trace for `GET /content/audio/mix` and check the span breakdown. You should see:

1. DB count query
2. DB data query
3. Creator batch query (single span, not per-item — this was fixed in item 2)
4. MDX compilation (should be near-zero after a warm cache)

If any span is still unexpectedly large, the trace will point exactly where. Jaeger is available locally via the `Otel_Stack` dev command.

---

### R6 — PlanetScale Query Insights

Check these specific queries in PlanetScale's Query Insights dashboard:

- `SELECT count(*) FROM audio WHERE type = 'mix'`
- `SELECT * FROM audio WHERE type = 'mix' ORDER BY created_at DESC LIMIT ? OFFSET ?`
- `SELECT DISTINCT unnest(tags) FROM audio WHERE type = 'mix'`

After the migration from R1, the composite index should move these from "full scan" to "index range scan". Confirm in Query Insights that `rows_examined ≈ rows_returned`.

---

### R7 — Baseline Lighthouse / Web Vitals

Run a before/after Lighthouse to quantify the impact of the changes above:

```bash
npx lighthouse https://goosebumps.fm/mixes --output json --output-path ./lighthouse-before.json
# after deploying and cache warming:
npx lighthouse https://goosebumps.fm/mixes --output json --output-path ./lighthouse-after.json
```

Key metrics to watch: **LCP** (should improve as API responds faster), **TTFB** (should drop once Cloudflare serves from edge cache).

---

## Architecture Notes

| Layer         | Current state                                                             | Notes                                                                                                  |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| CDN           | CloudFront (static assets) + Cloudflare (API DNS)                         | Cache-Control headers now enable Cloudflare edge caching for API responses                             |
| API           | Hono on ECS Spot, behind API Gateway V2                                   | Single AZ pure Spot — see R3                                                                           |
| DB            | PlanetScale (PostgreSQL-compatible)                                       | Missing indexes — see R1                                                                               |
| Observability | Sentry (1.0 sampling), OTEL + Jaeger locally                              | Drop sampling after baseline captured — see R2                                                         |
| Caching       | Effect.Cache in-process for MDX, React Query on client (staleTime varies) | No Redis/shared cache between ECS tasks                                                                |
| NAT           | Disabled (intentional)                                                    | ECS tasks cannot reach internet — affects Spotify/Bandcamp integrations if they're in the request path |
