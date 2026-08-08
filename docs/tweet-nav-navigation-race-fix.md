# Tweet nav navigation race, tech spec

## Summary

> **Status: revised after review.** The first draft attributed the
> observed 404 to a navigation race. A review pass found a second,
> likely-primary defect (an oversized `exclude` query string) and
> corrected several technical claims that had been asserted without
> verification. Read *Review finding* under Context before planning work.
> **Recommended order: fix Defect A first** (deterministic, grows with
> usage, best explains the reported symptom), then Defect B (the race).

Two defects in tweet navigation:

- **A.** The seen-slug exclusion list is sent as a comma-joined GET query
  param capped at 200 slugs, up to ~23 KB of request line, past common
  8–16 KB proxy limits. Truncation/rejection here is the most likely
  cause of the malformed slug and 404 in the bug report.
- **B.** Navigation intent has no single owner and no cancellation:
  firing hold-to-random, then acting again before the network round trip
  resolves, lets the stale call's `router.navigate` win. Last-*resolved*
  wins instead of last-*requested*.

This spec fully designs the fix for **B** (give navigation intent a
single owner with real cancellation, so only the most-recently-expressed
intent can complete a `router.navigate`). **A** is diagnosed and measured
here but not yet designed, it needs the environment limits answered
first (see Open Questions) and may fold into the server-side seen-set
work instead.

This spec extends **Part B, Prev/Next/Random** of
`docs/tweet-single-view-nav-search-plan.md`, which specified the
prev/next/random call stack but did not address concurrent/overlapping
navigation intents. It also supersedes the hold-to-random gesture work
done after that doc (`apps/www/src/components/HoldToRandomButton.tsx`,
`apps/www/src/components/TweetNav.tsx`), which introduced the async
hold-then-navigate path this bug lives in.

## Context / Current State

Three independent, uncoordinated triggers can call `router.navigate` to a
`/tweet/$slug` destination from `TweetNav`:

- **Tap prev** / **tap next** (`apps/www/src/components/TweetNav.tsx`,
  `goToPrev`/`goToNext`): synchronous. Reads `prev`/`next` from
  `useAdjacentMicroPosts(slug)` (`apps/www/src/lib/http.ts`), a
  `useQuery` keyed on the current route's `slug` param. Calls
  `router.navigate` immediately, no async gap.
- **Hold-to-random** (`apps/www/src/components/HoldToRandomButton.tsx` +
  `TweetNav`'s `onHoldComplete`): the button's own state machine
  (`Idle → Holding → Completing/Cancelled → Idle`) is a real,
  interruptible Effect-driven gesture recognizer, but the instant it
  decides the gesture completed, it fires `onHoldComplete()`, a plain
  callback with no return value the button can await, cancel, or relate
  back to gesture identity. `onHoldComplete` is wired to
  `useRandomMicroPost().goToRandom(slug)`
  (`apps/www/src/lib/http.ts:437-456`), an `async function` with:
  - a network round trip (`GET /api/content/posts/micro/random?exclude=...`),
  - then `router.navigate({ to: '/tweet/$slug', params: { slug } })`.

  Nothing tracks whether a previous `goToRandom` call is still in flight
  when a new one starts, and nothing links the async work back to the
  `HoldToRandomButton` instance or gesture that spawned it, once
  `Effect.runPromise` is fired, it runs to completion (or throws)
  regardless of anything that happens in the UI afterward.
- **Arrow keys** (`useHotkey('ArrowLeft'/'ArrowRight', goToPrev/goToNext)`
  in the same file): same synchronous path as tap.

`TweetNav` remounts (new `slug` prop, new `useAdjacentMicroPosts` query)
every time `router.navigate` actually completes a tweet-to-tweet
transition, but a `goToRandom` promise created by a previous mount
keeps running, it is a bare `async function` closure, not a fiber tied
to the component's lifecycle, so component unmount/remount does not
cancel it.

### Reproduction (observed, screenshot-confirmed)

1. Hold right arrow to trigger `goToRandom` from tweet A. The
   `GET .../random?exclude=...` request goes out.
2. Before that request resolves, act again, another hold, or a tap, or
   an arrow key, which (for tap/keys) navigates synchronously to tweet
   B, or (for a second hold) starts a second, overlapping
   `goToRandom` call.
3. The original `goToRandom` promise from step 1 eventually resolves.
   Its `router.navigate` fires regardless of what has happened on screen
   since, the user is now looking at whatever that stale call resolved
   to, not tweet B, not the result of their second action.
4. In the captured bug, the destination slug 404'd against
   `getMicroPostBySlug` (`GET .../posts/micro/<slug>` → `404`, fired
   twice, the second is TanStack Router re-invoking the loader after
   the first throw, a symptom of the bad navigation, not a separate root
   cause).

### Review finding: the race is probably NOT the primary cause

A review pass after the first draft of this spec found a second,
more likely explanation for the observed 404, which this spec's original
framing missed. Both defects are real and both should be fixed, but the
priority ordering below is now inverted from the original draft.

> **Defect A status: FIXED.** `getRandomMicroPost` moved from
> `GET ?exclude=a,b,c` to `POST` with `{ exclude: string[] }` in the body
> (`packages/api/src/post.ts`, `apps/vps/src/http/post.handlers.ts`,
> `apps/www/src/lib/http.ts`). Verified end-to-end: the same 200-slug
> payload that returned **HTTP 431** now returns **HTTP 200** at 23.6 KB,
> ~2.9× over the prod API Gateway ceiling that was breaking it.
> Defect B (the race) and Defect C (stale list) remain open.

**Defect A, `exclude` query string exceeds HTTP header/URL limits.**
`useRandomMicroPost` sends the seen-slug list as a comma-joined
**GET query parameter** (`?exclude=a,b,c`, per
`docs/tweet-single-view-nav-search-plan.md` Part B, which chose this
encoding deliberately to avoid `Schema.Array`-in-query ambiguity).
`MAX_SEEN` is 200 (`apps/www/src/store/tweetSeen.ts`). The slug in the
captured bug is 114 characters. Measured:

| seen slugs | raw `exclude` value | encoded request line |
| --- | --- | --- |
| 50 | 5,749 B | 5,887 B |
| 100 | 11,499 B | 11,737 B |
| 200 | 22,999 B | 23,437 B |

Common limits this crosses: nginx `large_client_header_buffers`
(8 KB default), Node's `--max-http-header-size` (16 KB default), and
typical CDN/proxy request-line caps (8–16 KB). A request that exceeds
them is rejected or **truncated**, and a truncated `exclude` list is a
direct mechanism for a malformed/partial slug reaching the server, which
matches the observed symptom ("mangled-looking slug", 404) far more
closely than the race does. The bug reproduced "after a mix of a few
skip-to-randoms", i.e. precisely as `seenSlugs` grew.

**CONFIRMED, this is a live prod bug, not a theoretical one.**

Environments traced:

- **Prod**: `infra/vps.ts` puts the service behind
  `sst.aws.ApiGatewayV2` (`vps_gateway`, domain `vps.goosebumps.fm`).
  API Gateway v2 caps the combined request line + header values at
  **8,192 bytes**, and that limit is **not configurable**.
- **Dev**: Vite proxy (`apps/www/vite.config.ts`) → Node on port 3003.
  Node's default `--max-http-header-size` is 16 KB.

Measured against the observed 114-char slug:

| seen slugs | encoded request | prod (8 KB) | dev (16 KB) |
| --- | --- | --- | --- |
| 10 | 1.1 KB | ok | ok |
| 70 | 8.2 KB | **over** | ok |
| 200 (`MAX_SEEN`) | 23.4 KB | **2.9× over** | **over** |

So in prod, random navigation breaks permanently once a user has seen
roughly **70 tweets**, well under the 200 the client is designed to
accumulate. Reproduced locally against the dev server:

```
10 slugs  (~1149B):  HTTP 200
70 slugs  (~8049B):  HTTP 200
200 slugs (~22999B): HTTP 431   # Request Header Fields Too Large
```

Dev only fails at the 200 cap because Node's ceiling is double API
Gateway's; prod fails much earlier. This is deterministic and grows with
usage, whereas the race (Defect B) requires precise timing to hit , 
which is why the priority ordering is inverted from the original draft.

**Defect B, the navigation race** (the original subject of this spec).
Real, confirmed by code inspection, and worth fixing, but it needs
overlapping user input within a network round trip to trigger, and it
does not by itself explain a *malformed* slug. It would more typically
produce "landed on the wrong valid tweet," not a 404.

**Defect C, stale `exclude` list (minor, related to A).**
`useRandomMicroPost`'s `useCallback` closes over `seen` with deps
`[router, seen]`. `useSeenTweets()` returns a new array identity on every
atom write, and `useRecordTweetViewed` writes on every tweet page mount,
so the closure is recreated on each navigation. The `exclude` list sent
is therefore always the value as of the render in which the gesture
started, one navigation stale. Harmless in isolation (worst case: the
random pick may return a tweet just seen), but it compounds A by making
the list's growth harder to reason about.

## Problem

- No single owner of "what tweet-navigation intent is currently in
  flight." Three call sites can each independently decide to navigate,
  with no shared coordination.
- No cancellation on the one async leg (`goToRandom`'s fetch). Every
  call runs an independent `Effect.runPromise` with no interrupt point,
  unlike `HoldToRandomButton`'s own tick-loop fiber, which *is*
  interruptible.
- Last-**resolved** wins, not last-**requested** wins. A slow random
  fetch started first can complete after a fast tap/next navigation
  started later, silently overriding the user's more recent, more
  deliberate action.
- `HoldToRandomButton`'s gesture state machine resets to `Idle`
  immediately when the *gesture* ends, with zero relationship to whether
  the *consequence* of that gesture (the async navigation) is still
  pending. The button is ready to accept a brand new hold before the
  previous hold's navigation has actually landed.

## Users / Callers

- `TweetNav` (`apps/www/src/components/TweetNav.tsx`), the only current
  consumer of `useRandomMicroPost`, `useAdjacentMicroPosts`, and
  `HoldToRandomButton`.
- No other current callers of any of the three affected modules.

## Goals

- Exactly one tweet-navigation intent can be "in flight" at a time, per
  page. Starting a new intent (tap, hold-complete, arrow key) always
  supersedes an older one that hasn't landed yet.
- A superseded intent's eventual result (a resolved random slug arriving
  late) must never call `router.navigate`.
- No behavior change to the parts that already work correctly: tap
  prev/next, arrow keys, and a *single, uncontested* hold-to-random all
  keep their current UX.
- Cancellation must reach the actual pending network request/Effect
  fiber, not just gate a callback after the fact, a superseded
  `goToRandom` call should stop doing work, not just have its result
  discarded.

## Non-Goals

- Not changing where "seen tweets" state lives (client `localStorage` vs.
  server session), that is a separate spec, deliberately out of scope
  here. See `docs/server-side-seen-tweets-notes.md`.
- Not changing `useAdjacentMicroPosts`'s caching/query behavior.

  Note (review correction): the original draft also claimed tap
  prev/next "does not need to change." That is inconsistent with the
  selected design. Tap/arrow-key navigation has no race *of its own*
  (it is synchronous), but under Option 3 it must still route through
  the shared intent runner, precisely so that a tap can **interrupt**
  a pending random fetch. Its externally observable behavior is
  unchanged; its call shape is not.
- Not adding optimistic UI, retry logic, or a loading spinner for the
  random fetch, out of scope unless it falls out naturally from the
  chosen design.
- Not touching `HoldToRandomButton`'s gesture recognizer internals
  (`nextHoldState`, the rAF tick loop), that state machine correctly
  models the *press-and-hold gesture*; the gap is entirely in what
  happens *after* it decides to fire `onHoldComplete`.

## Invariants

- At most one `router.navigate({ to: '/tweet/$slug', ... })` call from
  `TweetNav`'s random/prev/next paths can be in flight's *result* at any
  time; a second one starting always cancels the first before it can
  navigate.
- A cancelled `goToRandom` call never calls `router.navigate` and never
  throws an unhandled/uncaught error into the console from being
  abandoned mid-flight.
- Tap and arrow-key navigation remain synchronous and are never delayed
  or blocked by a pending random fetch.

## Design Constraints

- Must use Effect (already the pattern for `HoldToRandomButton`'s own
  gesture recognizer, and the codebase's general async idiom) for the
  cancellation mechanism, not a hand-rolled `AbortController` +
  `fetch`, the API client is already Effect-based
  (`client.post.getRandomMicroPost(...)` returns an `Effect`), so
  cancellation should be `Fiber.interrupt`, matching how
  `HoldToRandomButton` already cancels its own tick loop.
- Should not require `TweetNav` or `HoldToRandomButton` callers to change
  their public props/shape unless the chosen design genuinely needs it , 
  minimize churn to call sites outside the affected modules.
- Must keep `useRandomMicroPost`'s existing seen-slug exclusion behavior
  (`docs/tweet-browse-history-plan.md`'s documented contract: "Random
  navigation... eventually uses the same `/tweet/$slug` recording path as
  every other view" and "should not independently persist a seen slug")
 , this spec does not touch that contract, only the race around when
  `router.navigate` is allowed to fire.

## Alternatives Considered

### Option 1: `AbortController` per `goToRandom` call, stored in a module-level or `TweetNav`-level ref

Standard fetch-cancellation idiom: each `goToRandom` call creates a new
`AbortController`, stores it in a ref, and any previous controller is
`.abort()`ed before starting. `Effect.runPromise` would need to be
replaced with a signal-aware promise wrapper, or the underlying
`client.post.getRandomMicroPost` call would need an `AbortSignal` plumbed
through the Effect HTTP client.

- Rejected: the API client is Effect-native
  (`client.post.getRandomMicroPost(...)` is an `Effect`, not a bare
  `fetch`). Introducing `AbortController` here means bridging two
  different cancellation models (`AbortSignal` vs. `Fiber.interrupt`) for
  no benefit, Effect's own interruption already does exactly this job
  and composes with `Effect.tapError`/`captureException`, which the
  existing `goToRandom` implementation already uses. Would also diverge
  from `HoldToRandomButton`'s own cancellation model one file away,
  making the two halves of the same feature use different idioms for the
  same concept.

### Option 2: Sequence/generation counter, last-write-wins by comparing IDs

Every navigation intent gets an incrementing integer ID. Before calling
`router.navigate`, the async path checks whether its ID is still the
latest issued; if not, it's a no-op.

```ts
let latestIntentId = 0
const goToRandom = async (currentSlug: string) => {
  const intentId = ++latestIntentId
  const { slug } = await Effect.runPromise(...)
  if (intentId !== latestIntentId) return // superseded, do nothing
  router.navigate(...)
}
```

- Pro: simple, no new dependency surface, easy to reason about.
- Con: does not actually cancel the in-flight work, a superseded
  request still completes its full network round trip before being
  silently discarded. This satisfies "last-requested wins" for the
  *navigation* but not the stated goal that "a superseded intent should
  stop doing work, not just have its result discarded." It also does not
  naturally unify with tap/arrow-key intents (which are synchronous and
  don't need a counter) unless every intent, including instant ones, is
  routed through the same counter, awkward for something that never
  actually races today.
- Rejected: correctness-sufficient but weaker than Option 3 on the
  explicit "cancellation must reach the actual pending work" goal, and
  doesn't reuse the Effect-fiber idiom already established one file away
  in `HoldToRandomButton`.

### Option 3: Single Effect fiber owns all navigation intent, interrupted on every new intent

`TweetNav` owns one `useRef<Fiber.Fiber<void> | null>` for "the current
in-flight navigation effect." Every trigger, tap, arrow key, or
hold-complete, goes through one `runNavigationIntent(effect)` helper
that:

1. Interrupts whatever fiber is currently stored in the ref (if any).
2. Forks the new intent's Effect (`Effect.succeed(...)` for the
   synchronous tap/arrow-key case, the actual `getRandomMicroPost` Effect
   for the random case) and stores the new fiber in the ref.
3. The Effect itself ends with `Effect.sync(() => router.navigate(...))`
   as its last step, so `router.navigate` only ever runs as part of a
   fiber that was never interrupted, if it was interrupted, Effect's
   interruption model guarantees the rest of the Effect (including that
   final `router.navigate`) never runs.

- Pro: cancellation is real, interrupting the fiber actually stops the
  pending `getRandomMicroPost` Effect mid-flight, including aborting the
  underlying HTTP request. **Verified**, not assumed:
  `FetchHttpClient.js` builds its request as
  `HttpClient.make((request, url, signal, fiber) => ...)` and passes
  that fiber-derived `signal` straight into `fetch`, so fiber
  interruption propagates to a real `AbortSignal`. This is the same
  property `HoldToRandomButton` already relies on for its own tick
  loop. Unifies
  tap, arrow-key, and hold-random under one intent-ownership model
  without changing tap/arrow-key's actual synchronous feel (their
  Effects resolve in the same tick, so the fork-then-interrupt-previous
  dance is invisible latency-wise).
  Directly satisfies every stated invariant, including "cancellation
  must reach the actual pending network request."
- Con: slightly more ceremony than Option 2 for the synchronous
  tap/arrow-key paths, which didn't need any of this before. Requires
  wrapping `router.navigate`'s call sites in `Effect.sync`, a small but
  real shape change to `goToPrev`/`goToNext`.
- Selected. This is the only option that satisfies the explicit
  cancellation invariant, and it reuses the exact idiom
  (`Fiber`/`Effect.runFork`/`Fiber.interrupt`) already proven in
  `HoldToRandomButton` one file away, a reader who understands that
  component's cancellation model will recognize this one immediately.

## Recommendation

Option 3. Add a single-owner navigation-intent fiber to `TweetNav`,
expressed as one small helper hook (`useNavigationIntent` or inlined
directly in `TweetNav`, see Open Questions) that every trigger path
(tap, arrow key, hold-complete) routes through. `goToRandom` in
`useRandomMicroPost` changes from an `async function` that internally
calls `router.navigate` to an `Effect` that TweetNav's intent-owner runs
and interrupts, `useRandomMicroPost` stops owning navigation timing
itself and becomes a pure "build me the random-post Effect" hook.

## Proposed Design

### Domain Model and Types

```ts
// apps/www/src/components/TweetNav.tsx (or a small extracted hook,
// see Open Questions)

// No new domain state type is needed beyond a single fiber ref, this
// is infrastructure (an intent-cancellation seam), not new UI/domain
// state. Contrast with HoldToRandomButton's HoldState, which models
// real domain state (the gesture) and stays untouched by this spec.
```

### Types, Interfaces, and APIs

```ts
// apps/www/src/lib/http.ts

// BEFORE, goToRandom is async, owns navigation itself, not cancellable:
export function useRandomMicroPost() {
  const router = useRouter()
  const seen = useSeenTweets()
  const goToRandom = useCallback(async (currentSlug: string) => {
    const client = await getApiClient()
    const { slug } = await Effect.runPromise(
      client.post.getRandomMicroPost({ query: { exclude: [...seen, currentSlug].join(',') } })
        .pipe(Effect.tapError((error) => captureException(error, { endpoint: 'post.getRandomMicroPost' })))
    )
    router.navigate({ to: '/tweet/$slug', params: { slug } })
  }, [router, seen])
  return { goToRandom }
}

// AFTER, randomMicroPostEffect returns an Effect the caller runs and
// can interrupt; navigation itself moves to the caller (TweetNav),
// alongside the other navigation triggers, so all three share one
// owner.
export function useRandomMicroPost() {
  const seen = useSeenTweets()
  const randomMicroPostEffect = useCallback(
    (currentSlug: string): Effect.Effect<{ slug: string }, unknown> =>
      Effect.gen(function* () {
        const client = yield* Effect.promise(() => getApiClient())
        return yield* client.post
          .getRandomMicroPost({ query: { exclude: [...seen, currentSlug].join(',') } })
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'post.getRandomMicroPost' }))
          )
      }),
    [seen]
  )
  return { randomMicroPostEffect }
}
```

```ts
// apps/www/src/components/TweetNav.tsx

// New: single-owner intent runner. Interrupts any prior in-flight
// intent before starting a new one; the Effect passed in is
// responsible for calling router.navigate as its final step, so an
// interrupted intent never reaches that call.
function useNavigationIntent() {
  const fiberRef = useRef<Fiber.Fiber<void> | null>(null)

  useEffect(() => () => {
    if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current))
  }, [])

  return (intent: Effect.Effect<void>) => {
    if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current))
    fiberRef.current = Effect.runFork(intent)
  }
}
```

### Seams, Boundaries, Adapters, and Implementations

- **`useRandomMicroPost`** (`apps/www/src/lib/http.ts`): boundary
  shrinks to "produce the Effect that fetches a random slug," no longer
  owns `router` or navigation timing. This is the seam that lets
  `TweetNav` treat random-navigation identically to tap/arrow-key
  navigation, all three become "an `Effect<void>` that ends in
  `router.navigate`."
- **`useNavigationIntent`** (new, `TweetNav.tsx` or extracted): the one
  new seam this spec introduces, single fiber ownership for "the
  currently in-flight navigation," interrupted on every new intent and
  on unmount. This is intentionally the *only* place that decides
  whether a `router.navigate` call is allowed to run.
- **`HoldToRandomButton`**: unchanged. Its `onHoldComplete` callback
  contract stays exactly as-is (`() => void`); `TweetNav` wraps it in
  `useNavigationIntent`'s runner rather than calling `goToRandom`
  directly, so `HoldToRandomButton` remains fully decoupled from how its
  completion callback's async consequences are managed.

### Call Stacks and Data Flow

#### Current / Old Flow

```txt
tap next / ArrowRight
  -> router.navigate(...)                          [synchronous, immediate]

hold-complete (via HoldToRandomButton.onHoldComplete)
  -> goToRandom(slug)                               [async function, unmanaged]
       -> Effect.runPromise(getRandomMicroPost Effect)
       -> await network round trip
       -> router.navigate(...)                      [fires regardless of anything
                                                       that happened in the meantime]
```

No shared state between the two paths. Nothing prevents both from
targeting `router.navigate` in overlapping, unordered fashion.

#### Proposed / New Flow

```txt
TweetNav mount
  -> useNavigationIntent() -> { fiberRef: Fiber | null, run(intent) }

tap next / ArrowRight
  -> run(Effect.sync(() => router.navigate({ to: '/tweet/$slug', params: { slug: next.slug } })))
       -> interrupt fiberRef.current if set
       -> fork new intent, store in fiberRef
       -> Effect.sync body runs synchronously inside the fiber -> navigate happens
          on the same tick, no perceptible change from today's behavior

hold-complete (via HoldToRandomButton.onHoldComplete)
  -> run(
       randomMicroPostEffect(slug).pipe(
         Effect.flatMap(({ slug }) =>
           Effect.sync(() => router.navigate({ to: '/tweet/$slug', params: { slug } }))
         )
       )
     )
       -> interrupt fiberRef.current if set (cancels a still-pending prior
          random fetch, if any -- this is the actual bug fix)
       -> fork new intent, store in fiberRef
       -> network round trip
       -> on success: router.navigate runs
       -> if interrupted before completion: navigate step never runs
```

Every trigger funnels through the same `run` function, so a second tap,
a second hold, or an arrow key firing while a random fetch is still
in-flight always interrupts that fetch's fiber before it can navigate , 
last-*requested* wins, not last-*resolved* wins.

#### Failure Flow

- `randomMicroPostEffect`'s existing `Effect.tapError` →
  `captureException` behavior is preserved unchanged, a genuine network
  or server failure (not a supersede-interrupt) still reports through the
  existing error-observability path.
- An *interrupted* fiber does not run `Effect.tapError`, so no spurious
  `captureException` fires when an intent is cancelled by a newer one.

  **Verified empirically** against `effect@4.0.0-beta.99` rather than
  assumed. Probe: fork an `Effect.sleep(500)` piped through
  `Effect.tapError` and a final `Effect.flatMap(... side effect)`,
  interrupt at 50 ms, wait past the original deadline. Result:

  ```json
  { "tapErrorFired": false, "finalStepRan": false,
    "isInterrupted": true,  "isFailure": true }
  ```

  Two consequences for this design, both load-bearing:

  1. `finalStepRan: false` confirms the core mechanism, an interrupted
     fiber never reaches its trailing
     `Effect.sync(() => router.navigate(...))`. This is what makes
     Option 3 work at all.
  2. `isFailure: true` **alongside** `isInterrupted: true`, Effect
     models interruption as a *kind of* failure exit. A test (or any
     runtime branch) that checks `Exit.isFailure` alone will
     misclassify a normal supersede as an error. Always check
     `Exit.isInterrupted` **first**. The original draft of this spec
     did not flag this and would have led to a subtly wrong test.

#### Retry / Cancellation / Idempotency Flow

- Cancellation is the entire point of this spec, not an edge case, see
  Proposed Design above. No retry semantics are added; a cancelled
  intent is simply abandoned, matching `HoldToRandomButton`'s own
  cancelled-gesture behavior (no retry, gesture just resets).
- Idempotency: `router.navigate` to the same slug twice (e.g. if a user
  somehow triggers the same next-tweet navigation twice in a row) is
  already safe today, TanStack Router no-ops or re-resolves the same
  route; this spec does not change that.

#### Observability Flow

- No new telemetry. `captureException` call sites and their `endpoint`
  tags (`'post.getRandomMicroPost'`) are preserved as-is in the moved
  `randomMicroPostEffect`.

## Files to Add / Change / Delete

- **Change** `apps/www/src/lib/http.ts`: `useRandomMicroPost`, replace
  the async `goToRandom(currentSlug)` function with
  `randomMicroPostEffect(currentSlug): Effect.Effect<{ slug: string }, unknown>`.
  Remove the `router.navigate` call and `useRouter()` import from this
  hook, navigation moves to the caller.
- **Change** `apps/www/src/components/TweetNav.tsx`: add
  `useNavigationIntent` (inline or imported, see Open Questions);
  replace `goToPrev`/`goToNext`'s direct `router.navigate` calls and
  `onHoldComplete`'s `goToRandom(slug)` call with `run(...)`-wrapped
  Effects per the new flow above.
- **No change** `apps/www/src/components/HoldToRandomButton.tsx`: public
  props (`onTap`, `onHoldComplete`, `ariaLabel`, `className`, `children`)
  are unchanged; this spec does not touch the gesture recognizer.
- **Change (Defect C, small)** `apps/www/src/lib/http.ts`: read the seen
  list at Effect-execution time rather than closing over the render-time
  `seen` array, so the `exclude` sent reflects state at gesture time, not
  one navigation stale. `tweetSeen.ts` already exports a non-React
  `readTweetBrowseState()` for exactly this kind of non-render read
  (added for the `/tweets` landing loader per
  `docs/tweet-browse-history-plan.md`), use it inside the Effect instead
  of `useSeenTweets()` in the closure. This also drops `seen` from the
  `useCallback` deps, so the callback stops being recreated on every
  navigation.

  Verified safe: `readTweetBrowseState` is a real export
  (`tweetSeen.ts:43`) already used this way by
  `apps/www/src/routes/tweet/-landing.ts:10`, and it cannot lag the atom
 , `useRecordTweetViewed` calls `write(next)` synchronously inside the
  same atom update, so `localStorage` and the atom are always in step.
- **No change** `apps/www/src/store/tweetSeen.ts`,
  `apps/www/src/routes/tweet/$slug.tsx`'s `useRecordTweetViewed` call:
  the "mark seen on successful view" contract from
  `docs/tweet-browse-history-plan.md` is untouched, this spec only
  changes *when `router.navigate` is allowed to fire*, not what happens
  after a tweet page successfully loads.

## RGR TDD Test Plan

Per project convention (no unit tests for `route.tsx`/`page.tsx` files;
`TweetNav.tsx` and `http.ts` are plain modules, testable):

1. **Red**: calling `run(intentA)` then immediately `run(intentB)`
   (before `intentA` resolves) results in only `intentB`'s effect
   completing; `intentA`'s side effect (a spy) is never called.
   **Green**: implement `useNavigationIntent`'s interrupt-before-fork
   behavior.
2. **Red**: `randomMicroPostEffect(slug)` returns an `Effect` (not a
   Promise, not `void`) and does not call `router.navigate` itself , 
   assert via a spy that no navigation function is invoked when the
   Effect is run in isolation without the `Effect.flatMap(... navigate)`
   wrapper `TweetNav` adds.
   **Green**: implement the `useRandomMicroPost` shape change.
3. **Red**: running `run(intentA)` (a random-fetch effect, mocked with a
   controllable delay) then interrupting it externally (simulating a
   fast second tap) never calls `router.navigate` for `intentA`'s
   result, even after the mocked delay elapses.
   **Green**: confirms `Effect.sync(() => router.navigate(...))` placed
   as the final step of the Effect is correctly skipped on interruption.
4. **Red**: an interrupted intent does not call `captureException` (only
   a genuine `Effect.tapError`-caught failure should).
   **Green**: already confirmed true by probe (see Failure Flow) , 
   the test locks in the behavior.
   **Write it carefully**: interruption reports `isInterrupted: true`
   *and* `isFailure: true`. Assert `Exit.isInterrupted(exit)`; do **not**
   branch on `Exit.isFailure` alone or the test will pass for the wrong
   reason and would also accept a genuine error as a valid supersede.
5. **Red** (component-level, if `TweetNav` is tested directly): tap
   next, then before that resolves, tap prev, final route matches
   prev's target only, never next's, and never a stale random result
   from a previous test's hold gesture (if run in the same suite,
   guards against fiber-ref leakage across renders).
   **Green**: wire `goToPrev`/`goToNext`/`onHoldComplete` through the
   shared `run` function.
6. **Red** (component-level): unmounting `TweetNav` mid-flight (a
   pending random fetch) does not throw and does not call
   `router.navigate` after unmount (spy assertion after
   `act(() => unmount())`), mirroring `HoldToRandomButton`'s own
   unmount-cleanup test from the earlier hold-to-random spec.
   **Green**: wire the `useEffect` cleanup that interrupts
   `fiberRef.current` on unmount.

## Risks and Open Questions

- **Open question**: should `useNavigationIntent` be extracted as its
  own small hook/module (e.g.
  `apps/www/src/hooks/useNavigationIntent.ts`), or is it small enough to
  inline directly inside `TweetNav.tsx`? No other component currently
  needs "single-owner cancellable navigation intent," so inlining avoids
  a premature abstraction; extracting only pays off if a second consumer
  shows up. Recommend inlining unless a reviewer wants the seam made
  explicit for testability in isolation from `TweetNav`'s other
  rendering concerns.

- **Risk (review finding): the fiber ref's lifetime may be shorter than
  the intent's.** `useNavigationIntent`'s `useRef` lives in `TweetNav`,
  which is rendered by the `/tweet/$slug` route
  (`apps/www/src/routes/tweet/$slug.tsx:98`). A successful navigation
  changes the route param. If TanStack Router **remounts** the route
  subtree on param change (rather than re-rendering the same instance),
  the ref resets to `null` on the new mount and cross-navigation
  supersede is enforced only by the unmount cleanup, not by the
  ref comparison the design leans on.

  This is not fatal, the unmount cleanup interrupts the old fiber, which
  covers the important case, but the design as written is more fragile
  than it reads, and the mount-vs-render behavior was **not verified**.
  Determine this before implementing; if the route does remount, consider
  hoisting the intent owner above the route component, or accept
  unmount-cleanup as the actual enforcement mechanism and document it as
  such rather than implying the ref does the work.

- ~~**Open question (from Defect A)**: what are the actual request-line /
  header size limits in front of the API?~~ **ANSWERED**, prod is API
  Gateway v2 (hard 8 KB, not configurable), dev is Node (16 KB default).
  Breaks at ~70 seen tweets in prod. See the confirmation table in
  Context above.

  **Resolution chosen: move `exclude` from a GET query param to a POST
  request body.** Rejected alternatives: capping the sent list to a
  recent window (smaller change, but silently degrades exclusion quality
  and leaves the same class of bug latent if slugs grow longer), and
  jumping straight to a server-side seen-set (correct long-term, but a
  much larger change touching auth/schema, see
  `docs/server-side-seen-tweets-notes.md`). The POST change is
  a clean stepping stone toward that server-side work.
- **Open question**: the field bug's exact 404 (a mangled-looking slug
  from `getMicroPostBySlug`) was not fully isolated to *only* the race
  condition described here, it's also possible (not confirmed) that the
  dev dataset had a transient inconsistency (a post deleted or
  unpublished between the random pick and the page load) unrelated to
  timing. This spec fixes the structural race regardless, since it's a
  real bug independent of whether it's the *sole* explanation for the
  captured screenshot. If the 404 recurs after this fix ships, that
  would isolate a second, data-consistency-shaped issue worth its own
  investigation (e.g. `getRandomMicroPostEffect` racing a delete/draft
  toggle between its `SELECT` and the client's follow-up
  `getMicroPostBySlug`, a TOCTOU gap at the database level, not fixable
  by client-side cancellation).
- **Open question**: no existing client-side "is this a not-found error"
  helper was found (`grep` for `NotFoundError`/`isNotFound` in
  `apps/www/src` returned nothing). If a future fix wants the `$slug.tsx`
  loader to gracefully recover from a 404 (rather than just not-racing
  into one), that helper doesn't exist yet, out of scope here, noted
  for whoever picks up loader-level resilience.
- **Risk**: wrapping `router.navigate` calls in `Effect.sync(...)` and
  running them through `Effect.runFork` changes their execution from
  "synchronous during the event handler" to "synchronous inside a forked
  fiber, same microtask", in practice indistinguishable to the user or
  to React, since `Effect.runFork` on a pure-`Effect.sync` Effect runs
  synchronously to completion, but worth a manual check that no test or
  behavior implicitly depended on `router.navigate` being called
  *literally* inside the original pointer/click event handler's call
  frame (e.g. for `event.preventDefault()`-adjacent timing, inspection
  of current `goToPrev`/`goToNext`/hold-complete call sites shows none of
  them do this, so this risk is believed low but not exhaustively
  proven).
