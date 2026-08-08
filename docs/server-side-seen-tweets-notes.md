# Server-side seen-tweets, notes (not a spec yet)

## Why this file exists

While investigating the tweet-nav navigation race
(`docs/tweet-nav-navigation-race-fix.md`), the question came up: should
"which tweets has this user seen" (used to exclude from random-tweet
picks) live server-side, tied to an account/session, instead of
client-side `localStorage`? That's a real, separate architectural
question from the race bug. This file captures the current state and the
open decision so it doesn't get lost, it is **not** a tech spec and no
implementation should start from this file alone. Write a proper spec
(same `tech-spec` shape as the race-fix doc) before building anything
here.

## Current architecture (as of this writing, verified by reading code)

Seen-tweet state is **entirely client-side, unauthenticated, per-browser**:

- `apps/www/src/store/tweetSeen.ts`, a `persistedAtom`
  (`apps/www/src/store/persistedAtom.ts`) backed by
  `localStorage['gbfm-tweet-browse-state.json']`, schema-validated with
  Effect `Schema`, falls back to an empty state on decode failure.
- Shape (per `docs/tweet-browse-history-plan.md`, the doc that specified
  this):
  ```ts
  type TweetBrowseState = {
    readonly version: 1
    readonly lastViewed: { postId: string; slug: string; viewedAt: number } | null
    readonly seenSlugs: readonly string[] // capped at 200, oldest evicted first
  }
  ```
- Written by `useRecordTweetViewed()`, called from
  `apps/www/src/routes/tweet/$slug.tsx` on every successful page mount,
  this is the single write path for both `lastViewed` (resume pointer)
  and `seenSlugs` (random-exclusion list).
- Read by `useSeenTweets()` inside `useRandomMicroPost`
  (`apps/www/src/lib/http.ts`), which sends `seenSlugs` as a
  comma-joined `?exclude=` query param to
  `GET /api/content/posts/micro/random`.
- The backend (`getRandomMicroPostEffect`,
  `apps/vps/src/services/post.service.ts`) is **fully stateless** with
  respect to "seen", it has no concept of a user's viewing history at
  all. It only ever excludes whatever slug list the client happens to
  send with that specific request.

No cookie, no server session, no DB table, no auth-gated behavior is
involved anywhere in this path today. A logged-in user and an anonymous
visitor behave identically, "seen" is a property of the browser/device,
not the account.

## Why this is a separate concern from the navigation race

The race bug (`docs/tweet-nav-navigation-race-fix.md`) is about *which
navigation intent is allowed to call `router.navigate`* when multiple
overlapping intents exist. Moving `seenSlugs` server-side would change
*where the exclusion list is sourced from*, it would not, by itself,
stop two concurrent `goToRandom`-equivalent calls from racing each
other. The two are orthogonal: the race fix is required regardless of
where seen-state lives, and moving seen-state server-side would still
need the race fix on top of it (a server-backed random-pick endpoint can
race exactly the same way on the client side).

## The actual question, if this gets picked up later

Is "seen tweets" meant to be:

1. **A per-device UX nicety** (don't show me the same random tweet twice
   in a row on this browser), current behavior, arguably sufficient,
   zero server cost.
2. **A per-account property** (I want random-tweet exclusion to follow
   me across devices, survive a cleared browser, and possibly persist
   the resume pointer too), requires auth-gated state, a real design
   decision about anonymous users (do they get nothing? a
   session-cookie-scoped fallback? do we merge local history into the
   account on first login?).

`docs/tweet-browse-history-plan.md`'s own **Non-goals** section already
states "No cross-device synchronization" and "No authenticated
server-side history" as deliberate, explicit exclusions for that
feature's first version, so moving to server-side would be a scope
change to an already-shipped, already-specified feature, not a bug fix.

## Open questions for a future spec

- Does server-side seen-state *replace* `localStorage`, or merge with it
  (e.g. anonymous browsing still uses `localStorage`, and it gets synced
  server-side only after login)?
- Is `seenSlugs` per-user (one list regardless of device/session) or
  per-session (resets on logout, multiple concurrent sessions have
  independent lists)?
- Does the 200-slug cap and FIFO eviction (`docs/tweet-browse-history-plan.md`'s
  `MAX_SEEN`) still make sense as a server-side table, or does an
  unbounded history become viable/desirable once it's not constrained by
  `localStorage`'s practical size limits?
- Does `lastViewed` (the resume pointer) move server-side alongside
  `seenSlugs`, or only the exclusion list? They're currently one atom/one
  write path (`useRecordTweetViewed`), splitting them would be a real
  design decision, not a given.
- What happens to logged-out/anonymous users under this design, do they
  lose random-exclusion entirely, keep the current `localStorage`
  behavior as a fallback, or get a session-cookie-scoped server-side list
  even without an account?
- Does this need a new DB table (`user_seen_posts` or similar), or can it
  reuse an existing per-user activity/preferences table if one exists?
  Not yet checked against the current schema.

## Recommendation (non-binding, for whoever picks this up)

Do not start this until there's a concrete product reason to want
cross-device or account-tied exclusion, the current design was
deliberately scoped small (`docs/tweet-browse-history-plan.md`'s
Non-goals), and nothing about the navigation race requires it. When it
does get picked up, write a full tech spec (same shape as
`docs/tweet-nav-navigation-race-fix.md`) rather than building from this
notes file directly, this file is scoped to "capture the question," not
"answer it."
