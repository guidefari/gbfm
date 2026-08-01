# Tweet Single-View, Nav, Search & Tags — Tech Spec

## Goal

1. `/tweet/$slug` becomes a single-tweet reading view with Prev/Next
   (chronological, Next = newer) and Random (excludes current + a
   client-tracked "seen" set).
2. `/tweet` index becomes a compact list + search bar (no more card feed).
3. Search covers tweet text and, at full depth, any music entity embedded
   in a tweet (track/album/playlist, including artists and — for
   playlists — the tracks they contain).
4. Microposts support hashtag/genre tagging via the **existing**
   `posts.tags` column — no new tagging system.

## Confirmed Decisions

| Decision | Choice |
|---|---|
| List page | Replace card feed with compact list + search bar |
| Nav direction | Next = newer, Prev = older |
| Search entry point | Bar on `/tweet` index (no separate route) |
| Random repeats | Exclude current + client-tracked seen-set (Atom + localStorage, via `persistedAtom`) |
| Music entity search depth | Full: canonical artist joins, playlist → tracks |
| Tag storage | Reuse `posts.tags text[]` (no new table) |
| Genre vs hashtag | Same concept, one flat namespace |

---

## Part A — Tags/Genres (do this first — it's the small, low-risk piece)

### What already exists

- `posts.tags` — `text[]`, GIN-indexed (`posts_tags_gin_idx`), already
  read/written by `insertPostSchema`/`updatePostSchema` and the create/update
  handlers. Nothing to add here.
- `arrayContains(postsTable.tags, [tag])` — already used by
  `getByTagEffect` (all post types) and inline in `getAllEffect` (accepts a
  `tag` filter alongside `type`).
- `getEditorialTagsEffect` — distinct tags, but **scoped to `type = 'post'`
  only**. No micro-post equivalent exists.

### The gap

`apps/www/src/routes/tweet/index.tsx` currently derives its tag filter
strip (`allTags`) by scanning whatever posts happen to be loaded client-side
(`useMemo` over `data`). That breaks once the index stops eagerly loading
the full feed (Part C) — a tag from a tweet that isn't on the currently
loaded page would never appear in the filter strip. Need a real endpoint.

### Interfaces

**`apps/vps/src/services/post.service.ts`** — add to `PostService`:

```ts
readonly getMicroTags: () => Effect.Effect<string[], DatabaseError>
```

Implementation mirrors `getEditorialTagsEffect` exactly, just
`eq(postsTable.type, 'micro')` instead of `'post'`:

```ts
const getMicroTagsEffect = () =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .selectDistinct({ tag: sql<string | null>`unnest(${postsTable.tags})` })
          .from(postsTable)
          .where(and(eq(postsTable.type, 'micro'), eq(postsTable.draft, false))),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch micro tags: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })
    return rows.map((r) => r.tag).filter((t): t is string => Boolean(t)).toSorted()
  })
```

**`packages/api/src/post.ts`** — add endpoint:

```ts
export const GetMicroTagsResponse = Schema.Array(Schema.String)
```

```ts
.add(
  HttpApiEndpoint.get('getMicroTags', '/api/content/posts/micro/tags', {
    success: GetMicroTagsResponse,
    error: HttpApiError.InternalServerError
  })
)
```

**`apps/vps/src/http/post.handlers.ts`** — handler, same shape as
`getEditorialTags` (including the `Cache-Control` header — tag lists are
cheap to cache):

```ts
.handle('getMicroTags', () =>
  Effect.gen(function* () {
    const svc = yield* PostService
    const tags = yield* dieOnDatabaseError(svc.getMicroTags())
    const body = yield* Schema.encodeEffect(GetMicroTagsResponse)(tags).pipe(Effect.orDie)
    return HttpServerResponse.setHeader(
      yield* HttpServerResponse.json(body).pipe(Effect.orDie),
      'Cache-Control',
      'public, max-age=3600, stale-while-revalidate=86400'
    )
  })
)
```

**`apps/www/src/lib/http.ts`**:

```ts
export function useMicroTags() {
  return useQuery<string[], Error>({
    queryKey: ['posts', 'micro', 'tags'],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.post.getMicroTags().pipe(
          Effect.tapError((error) => captureException(error, { endpoint: 'post.getMicroTags' }))
        )
      )
    },
    staleTime: 5 * 60 * 1000
  })
}
```

`/tweet/index.tsx` swaps its `useMemo`-derived `allTags` for
`useMicroTags()`. `tag` filtering when listing already works server-side via
`getMicroPosts` — but that endpoint doesn't currently accept a `tag` param
(only `getAllEffect`/`getByTagEffect` do). **Small addition needed:** extend
`getMicroPosts` query/service signature to accept an optional `tag`, same
pattern as `getEditorialPosts` already does. This was silently missing
before because the old index filtered tags client-side over the whole
loaded feed; the compact-list rewrite needs the server to filter instead.

No hashtag parsing, no `#` syntax in content — tags stay a separate
structured field on the post (title/content/tags are independent inputs),
exactly as they work for editorial posts today. Nothing here is new
conceptually; it's closing a parity gap.

---

## Part B — Prev/Next/Random

### Call stack

```
$slug.tsx (TweetNav component)
  → useAdjacentMicroPosts(slug)          [www/lib/http.ts]
    → client.post.getAdjacentMicroPosts  [Effect HttpApiClient]
      → GET /api/content/posts/micro/:slug/adjacent
        → post.handlers.ts: getAdjacentMicroPosts
          → PostService.getAdjacentMicroPosts(slug)
            → postsTable query x2 (prev, next)

TweetNav "Random" button
  → useRandomMicroPost().goToRandom()    [www/lib/http.ts]
    → useSeenTweets()                    [www/store/tweetSeen.ts, Atom, localStorage-backed]
    → client.post.getRandomMicroPost({ exclude: [...seen, currentSlug] })
      → GET /api/content/posts/micro/random?exclude=a,b,c
        → post.handlers.ts: getRandomMicroPost
          → PostService.getRandomMicroPost(excludeSlugs)
            → postsTable query (random, excluding slugs; retries w/o exclude if 0 rows)
    → router.navigate({ to: '/tweet/$slug', params: { slug: result.slug } })
    → useMarkTweetSeen()(result.slug)    [writes through to the atom + localStorage]

$slug.tsx (on mount, any navigation path)
  → useMarkTweetSeen()(slug)             [marks "seen" on every view, not just via random]
```

### Interfaces

**`packages/api/src/post.ts`**:

```ts
const MicroPostSummary = Schema.Struct({
  slug: Schema.String,
  title: Schema.NullOr(Schema.String)
})

export const GetAdjacentMicroPostsResponse = Schema.Struct({
  prev: Schema.NullOr(MicroPostSummary),
  next: Schema.NullOr(MicroPostSummary)
})

export const GetRandomMicroPostResponse = Schema.Struct({
  slug: Schema.String
})

// Comma-joined string, not Schema.Array -- grepping the rest of
// packages/api/src confirms no existing endpoint puts Schema.Array in a
// `query` field (array usages found are all in payloads/responses), so
// there's no proven pattern here for how Effect HttpApi encodes/decodes an
// array-valued query param. Rather than be the first to find out, encode
// as a single comma-joined string and split server-side -- same trick
// already used for simple list-ish query params in plenty of REST APIs,
// zero ambiguity, and trivially testable with a single curl.
const GetRandomMicroPostQuery = {
  exclude: Schema.optional(Schema.String) // comma-joined slugs
}
```

```ts
.add(
  HttpApiEndpoint.get('getAdjacentMicroPosts', '/api/content/posts/micro/:slug/adjacent', {
    params: SlugParam,
    success: GetAdjacentMicroPostsResponse,
    error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
  })
)
.add(
  HttpApiEndpoint.get('getRandomMicroPost', '/api/content/posts/micro/random', {
    query: GetRandomMicroPostQuery,
    success: GetRandomMicroPostResponse,
    error: HttpApiError.InternalServerError
  })
)
```

`exclude` is a comma-joined string (see comment above), split into an array
in the handler before calling `PostService.getRandomMicroPost`:

```ts
.handle('getRandomMicroPost', ({ query }) =>
  Effect.gen(function* () {
    const svc = yield* PostService
    const excludeSlugs = query.exclude ? query.exclude.split(',').filter(Boolean) : []
    const result = yield* dieOnDatabaseError(svc.getRandomMicroPost(excludeSlugs))
    return result
  })
)
```

Client (`useRandomMicroPost`) does `[...seen, currentSlug].join(',')` before
calling. Simple, no schema ambiguity, easy to curl-test directly.

**`apps/vps/src/services/post.service.ts`** — add to `PostService`:

```ts
readonly getAdjacentMicroPosts: (
  slug: string
) => Effect.Effect<
  { prev: { slug: string; title: string | null } | null
    next: { slug: string; title: string | null } | null },
  DatabaseError | NotFoundError
>
readonly getRandomMicroPost: (
  excludeSlugs: string[]
) => Effect.Effect<{ slug: string }, DatabaseError | NotFoundError>
```

Implementation sketch:

```ts
const getAdjacentMicroPostsEffect = (slug: string) =>
  Effect.gen(function* () {
    const current = yield* /* fetch createdAt for slug, type=micro, draft=false; NotFoundError if missing */

    const prevRows = yield* Effect.tryPromise(() =>
      db.select({ slug: postsTable.slug, title: postsTable.title })
        .from(postsTable)
        .where(and(
          eq(postsTable.type, 'micro'),
          eq(postsTable.draft, false),
          lt(postsTable.createdAt, current.createdAt)
        ))
        .orderBy(desc(postsTable.createdAt))
        .limit(1)
    )

    const nextRows = yield* Effect.tryPromise(() =>
      db.select({ slug: postsTable.slug, title: postsTable.title })
        .from(postsTable)
        .where(and(
          eq(postsTable.type, 'micro'),
          eq(postsTable.draft, false),
          gt(postsTable.createdAt, current.createdAt)
        ))
        .orderBy(asc(postsTable.createdAt))
        .limit(1)
    )

    return { prev: prevRows[0] ?? null, next: nextRows[0] ?? null }
  })
```

```ts
const getRandomMicroPostEffect = (excludeSlugs: string[]) =>
  Effect.gen(function* () {
    const baseCondition = and(eq(postsTable.type, 'micro'), eq(postsTable.draft, false))
    const withExclude = excludeSlugs.length > 0
      ? and(baseCondition, notInArray(postsTable.slug, excludeSlugs))
      : baseCondition

    const rows = yield* Effect.tryPromise(() =>
      db.select({ slug: postsTable.slug })
        .from(postsTable)
        .where(withExclude)
        .orderBy(sql`random()`)
        .limit(1)
    )

    if (rows[0]) return rows[0]

    // exclude list covered everything — fall back to unfiltered
    const fallback = yield* Effect.tryPromise(() =>
      db.select({ slug: postsTable.slug })
        .from(postsTable)
        .where(baseCondition)
        .orderBy(sql`random()`)
        .limit(1)
    )

    if (!fallback[0]) return yield* new NotFoundError({ message: 'No micro posts exist', resource: 'post', id: 'random' })
    return fallback[0]
  })
```

### Seen-set: Atom, not a hand-rolled store

Revised from the earlier draft. `apps/www` has no prior IndexedDB usage
anywhere in the codebase, but it does have an established pattern for
exactly this shape of state — small, persisted, reactive client data — in
`apps/www/src/store/persistedAtom.ts` (`playbackAtom`, `visibilityAtom`,
etc. are all built on it). Writing a bespoke IndexedDB wrapper here would
introduce a second, one-off persistence mechanism where an existing,
already-tested one fits: ~200 slugs is trivial for localStorage, and
`persistedAtom` already handles schema-validated decode-with-fallback, so
a corrupted/outdated stored value can't break the page. Using it also makes
the seen-set properly reactive via `@effect/atom-react`, instead of an
untracked async side-channel — matches [[project_www_no_zustand]] (all www
client state is Effect atoms).

**`apps/www/src/store/tweetSeen.ts`** (new file):

```ts
import { Schema } from 'effect'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { persistedAtom } from './persistedAtom'

const MAX_SEEN = 200

const SeenTweets = Schema.Array(Schema.String)

const { atom: seenTweetsAtom, write } = persistedAtom({
  key: 'gbfm-tweet-seen.json',
  schema: SeenTweets,
  fallback: []
})

export { seenTweetsAtom }

export const useSeenTweets = (): readonly string[] => useAtomValue(seenTweetsAtom)

export const useMarkTweetSeen = () => {
  const set = useAtomSet(seenTweetsAtom)
  return (slug: string) =>
    set((prev) => {
      if (prev.includes(slug)) return prev
      const next = [...prev, slug]
      const capped = next.length > MAX_SEEN ? next.slice(next.length - MAX_SEEN) : next
      write(capped)
      return capped
    })
}

export const useResetSeenTweets = () => {
  const set = useAtomSet(seenTweetsAtom)
  return () =>
    set(() => {
      write([])
      return []
    })
}
```

Confirmed against `@effect/atom-react@4.0.0-beta.99`'s actual type defs
(`dist/Hooks.d.ts`): `useAtomSet`'s returned setter type is
`(value: W | ((value: R) => W)) => void` — the updater-function form used
above (`set((prev) => next)`) is valid, not just an assumption from
`playbackAtom`'s (direct-value-only) usages elsewhere in the codebase.

**`apps/www/src/lib/http.ts`**:

```ts
export function useAdjacentMicroPosts(slug: string) {
  return useQuery({
    queryKey: ['post', 'micro', slug, 'adjacent'],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(client.post.getAdjacentMicroPosts({ params: { slug } }))
    },
    enabled: Boolean(slug)
  })
}

export function useRandomMicroPost() {
  const router = useRouter()
  const seen = useSeenTweets()
  const markSeen = useMarkTweetSeen()

  const goToRandom = useCallback(
    async (currentSlug: string) => {
      const client = await getApiClient()
      const { slug } = await Effect.runPromise(
        client.post.getRandomMicroPost({
          query: { exclude: [...seen, currentSlug].join(',') }
        })
      )
      markSeen(slug)
      router.navigate({ to: '/tweet/$slug', params: { slug } })
    },
    [router, seen, markSeen]
  )

  return { goToRandom }
}
```

### Component

**`apps/www/src/components/TweetNav.tsx`** (new):

```ts
interface TweetNavProps {
  slug: string
}
```

Renders Prev / Random / Next. Prev/Next are `Link`s (or `null`/disabled
span when absent) using `useAdjacentMicroPosts(slug)`; Random is a button
calling `goToRandom(slug)`. Keyboard: attach `←`/`→` listeners scoped to
this component's mount (check for existing global key-handling patterns in
the app before adding a new `useEffect` + `addEventListener` — reuse if one
exists).

`$slug.tsx` calls `useMarkTweetSeen()(slug)` once per mount (in a
`useEffect`), regardless of how the tweet was reached — "seen" means
"viewed," not "reached via random."

---

## Part C — Search

### Call stack

```
/tweet index.tsx (search input, debounced)
  → useMicroPostSearch(query)            [www/lib/http.ts]
    → client.post.searchMicroPosts({ query: { q, limit, offset } })
      → GET /api/content/posts/micro/search?q=...&limit=&offset=
        → post.handlers.ts: searchMicroPosts
          → PostService.searchMicroPosts({ q, limit, offset })
            → single SQL query: posts LEFT JOIN (per-type EXISTS subqueries)
            → buildPostWithPreloadedCreators (existing helper, reused)
```

### The query — full architecture

One query, `WHERE` clause built from:

```
(posts.title ILIKE :pattern OR posts.content ILIKE :pattern)
OR (posts.musicEntityType = 'track'    AND EXISTS (<track match>))
OR (posts.musicEntityType = 'album'    AND EXISTS (<album match>))
OR (posts.musicEntityType = 'playlist' AND EXISTS (<playlist match>))
```

Each `<... match>` is scoped to `entityId = posts.musicEntityId`, so it's a
correlated subquery, not a join against the whole `posts` result set.

**`<track match>`** — matches on the track's own title/artistNames, its
canonical artist(s), and its parent album's title:

```sql
EXISTS (
  SELECT 1 FROM music_tracks t
  LEFT JOIN music_albums alb ON alb.id = t.album_id
  WHERE t.id = posts.music_entity_id
    AND (
      t.title ILIKE :pattern
      OR t.artist_names::text ILIKE :pattern
      OR alb.title ILIKE :pattern
      OR EXISTS (
        SELECT 1 FROM music_track_artists mta
        JOIN music_artists a ON a.id = mta.artist_id
        WHERE mta.track_id = t.id AND a.name ILIKE :pattern
      )
    )
)
```

**`<album match>`** — same shape, one level shallower (no parent to climb):

```sql
EXISTS (
  SELECT 1 FROM music_albums alb
  WHERE alb.id = posts.music_entity_id
    AND (
      alb.title ILIKE :pattern
      OR alb.artist_names::text ILIKE :pattern
      OR EXISTS (
        SELECT 1 FROM music_album_artists maa
        JOIN music_artists a ON a.id = maa.artist_id
        WHERE maa.album_id = alb.id AND a.name ILIKE :pattern
      )
    )
)
```

**`<playlist match>`** — playlist's own fields, or any track it contains
(recursing into the same track-match logic, minus the album hop):

```sql
EXISTS (
  SELECT 1 FROM music_playlists pl
  WHERE pl.id = posts.music_entity_id
    AND (
      pl.title ILIKE :pattern
      OR pl.description ILIKE :pattern
      OR EXISTS (
        SELECT 1 FROM music_playlist_tracks mpt
        JOIN music_tracks t2 ON t2.id = mpt.track_id
        WHERE mpt.playlist_id = pl.id
          AND (
            t2.title ILIKE :pattern
            OR t2.artist_names::text ILIKE :pattern
            OR EXISTS (
              SELECT 1 FROM music_track_artists mta2
              JOIN music_artists a2 ON a2.id = mta2.artist_id
              WHERE mta2.track_id = t2.id AND a2.name ILIKE :pattern
            )
          )
      )
    )
)
```

Ordering: `ORDER BY posts.created_at DESC` — no relevance scoring in v1.

### Drizzle expression, at the service layer

Given the nesting depth, hand-write this as a `sql` template in Drizzle
rather than trying to compose it from `and`/`or`/`exists` helpers — the
per-type branching doesn't map cleanly onto Drizzle's relational query
builder, and forcing it through the builder would be harder to read than
the raw SQL above. This is one of the few places in this codebase where a
`sql\`...\`` escape hatch is the more readable option (`getEditorialTagsEffect`
already does this for `unnest`).

```ts
const searchMicroPostsEffect = (options: { q: string; limit: number; offset: number }) =>
  Effect.gen(function* () {
    const pattern = `%${options.q}%`
    const whereSql = sql`
      posts.type = 'micro' AND posts.draft = false
      AND (
        posts.title ILIKE ${pattern} OR posts.content ILIKE ${pattern}
        OR (posts.music_entity_type = 'track' AND EXISTS (...))
        OR (posts.music_entity_type = 'album' AND EXISTS (...))
        OR (posts.music_entity_type = 'playlist' AND EXISTS (...))
      )
    `
    // count query with same whereSql, then data query + limit/offset/orderBy
    // map rows through buildPostWithPreloadedCreators, same as getAllEffect
  })
```

Interface addition to `PostService`:

```ts
readonly searchMicroPosts: (options: {
  q: string
  limit: number
  offset: number
}) => Effect.Effect<
  { data: SelectMdxCompiledMicroPost[]; pagination: PaginationMetadata },
  DatabaseError,
  SentryService
>
```

**`packages/api/src/post.ts`**:

```ts
const SearchMicroPostsQuery = {
  ...PaginationQuery,
  q: Schema.NonEmptyString
}
```

```ts
.add(
  HttpApiEndpoint.get('searchMicroPosts', '/api/content/posts/micro/search', {
    query: SearchMicroPostsQuery,
    success: GetMicroPostsResponse,   // reuse existing shape
    error: HttpApiError.InternalServerError
  })
)
```

**`apps/www/src/lib/http.ts`**:

```ts
export function useMicroPostSearch(q: string, limit = DEFAULT_PAGE_SIZE) {
  return useInfiniteQuery<PaginatedResponse<SelectMdxCompiledMicroPost>, Error>({
    queryKey: ['posts', 'micro', 'search', q, limit],
    queryFn: async ({ pageParam = 0 }) => {
      const client = await getApiClient()
      const result = await Effect.runPromise(
        client.post.searchMicroPosts({ query: { q, limit, offset: Number(pageParam) } })
      )
      return { data: result.data.map(/* same date/tags/creators mapping as useMicroPosts */), pagination: result.pagination }
    },
    initialPageParam: 0,
    getNextPageParam: getNextOffsetPageParam,
    enabled: q.trim().length > 0
  })
}
```

### Performance note (be upfront about this)

`ILIKE '%term%'` can't use a btree index (leading wildcard) — every branch
here is a sequential-ish scan or index-assisted-at-best lookup. At expected
volume (a personal blog's worth of tweets/tracks/albums) this is fine and
matches CLAUDE.md's 80/20 guidance. If it ever gets slow: the fix is a
`pg_trgm` GIN index per searched text column (`posts.title`, `posts.content`,
`music_tracks.title`, `music_artists.name`, etc.) — no query rewrite needed,
`ILIKE` with `pg_trgm` indexes is a drop-in speedup. Not doing this now
(YAGNI) but noting it so it's a known, cheap escape hatch rather than a
future rabbit hole.

---

## Part D — `/tweet` index rebuild

- Compact list: one row per tweet (title-or-first-line + date), linking to
  `/tweet/$slug`. Replaces `TweetListCard`'s big-card rendering as the
  default view.
- Tag filter strip now driven by `useMicroTags()` (Part A) instead of the
  client-derived `allTags`.
- Search input above the list. When `q` is non-empty, render
  `useMicroPostSearch(q)` results instead of `useMicroPosts()` +
  client-side tag filter. Tag filter and search are mutually exclusive in
  v1 (don't try to combine `tag` + `q` server-side yet — no current
  endpoint supports both, and it's not clear it's needed) — clarify with
  user if combined filtering turns out to matter once this is live.
- New component: `TweetListRow` (compact), replacing `TweetListCard` on
  this route. `TweetListCard` can stay as-is if it's used elsewhere;
  confirm before deleting.

---

## Build Order

1. **Part A (tags)** — smallest, no new query complexity, unblocks the
   index rebuild's tag strip.
2. **Part B (adjacent/random)** — straightforward two-query and
   one-query-with-fallback service methods.
3. **Part C (search)** — the one piece worth slowing down for; build and
   manually verify each `EXISTS` branch (track, album, playlist-via-track)
   independently against real data before trusting the combined query.
4. **Part D (index rebuild)** — depends on A and C being live.
5. `TweetNav` + keyboard nav + `store/tweetSeen.ts` (Atom) on `$slug.tsx`.
6. `bun precommit`.

