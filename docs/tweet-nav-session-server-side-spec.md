# Server-Side Tweet Navigation Session

**Tracked in Linear:** [OPS-224](https://linear.app/guidefari/issue/OPS-224/server-side-tweet-navigation-session) (parent)

| Ticket | Work | Blocked by |
| --- | --- | --- |
| [OPS-225](https://linear.app/guidefari/issue/OPS-225/navigation-domain-core-pure-trail-and-cursor-logic) | Domain core: pure trail and cursor logic | start here |
| [OPS-226](https://linear.app/guidefari/issue/OPS-226/navigation-session-schema-and-migration) | Schema and migration | none |
| [OPS-229](https://linear.app/guidefari/issue/OPS-229/optional-auth-identity-resolver-for-signed-in-and-anonymous-readers) | Optional auth: identity resolver | none |
| [OPS-227](https://linear.app/guidefari/issue/OPS-227/navigation-service-replay-path-append-path-row-lock) | Service: replay path, append path, row lock | 225, 226 |
| [OPS-228](https://linear.app/guidefari/issue/OPS-228/navigate-endpoint-and-api-contract) | Navigate endpoint and API contract | 227, 229 |
| [OPS-230](https://linear.app/guidefari/issue/OPS-230/rewrite-tweetnav-against-the-navigate-endpoint-with-prefetch) | TweetNav rewrite with prefetch | 228 |
| [OPS-231](https://linear.app/guidefari/issue/OPS-231/cutover-delete-the-old-endpoints-and-localstorage-store) | Cutover and deletions | 230 |
| [OPS-232](https://linear.app/guidefari/issue/OPS-232/anonymous-session-retention-sweep-30-days) | Retention sweep, 30 days | 226 |

OPS-225, OPS-226 and OPS-229 have no blockers and can run in parallel.

## Summary

Right now, `back` does not go back.

The arrows walk the corpus by date. Random drops you anywhere. So if you
jump to a random tweet and press `back`, you do not return to the tweet you
came from. You land on whatever sits next to the random one by date. That
is the bug.

The fix: the server remembers the path each reader walked, and owns the
"where next" decision. `back` then means back, whatever the last move was.

The problem is not where we keep the data. **The arrows and random answer
two different questions**, and nothing today ties them together. Moving
state to the server without fixing that would just move the bug.

## Context / Current State

Read from the code, not assumed.

### Where state lives now

`apps/www/src/store/tweetSeen.ts`, a `persistedAtom` backed by
`localStorage['gbfm-tweet-browse-state.json']`:

```ts
type TweetBrowseState = {
  readonly version: 1;
  readonly lastViewed: {
    postId: string;
    slug: string;
    viewedAt: number;
  } | null;
  readonly seenSlugs: readonly string[]; // capped at MAX_SEEN = 200, FIFO
};
```

Single write path: `useRecordTweetViewed()`, called from a `useEffect` in
`apps/www/src/routes/tweet/$slug.tsx` keyed on `slug`. It writes both
`lastViewed` and appends to `seenSlugs`.

### The two questions

The arrows (`getAdjacentMicroPostsEffect`,
`apps/vps/src/services/post.service.ts:597`) answer "what was posted next
to this one?" They read `postsTable.createdAt` and know nothing about the
reader:

- `prev` = the next post **newer** than current (`gte createdAt`, `asc`, limit 1)
- `next` = the next post **older** than current (`lte createdAt`, `desc`, limit 1)

Random (`getRandomMicroPostEffect`,
`apps/vps/src/services/post.service.ts:676`) picks any live top-level micro
post the client did not list in `excludeSlugs`.

So `prev` means "the tweet posted just after this one," not "the tweet I
was just reading." Random breaks the two apart: land somewhere by random,
press `prev`, and you get a date-neighbour of a tweet you reached by
chance. Nothing in the product answers "where was I?" except the browser
back button, which knows none of this.

That is the gap. Storage is not the problem.

### What the backend knows about users

Nothing, on this path. `getRandomMicroPost` and `getAdjacentMicroPosts` are
both public (no `.middleware(AuthMiddleware)`, `packages/api/src/post.ts:284`
and `:298`). A logged-in user and an anonymous visitor behave identically.

Auth exists and works (`apps/vps/src/middleware/auth.impl.ts`, better-auth
via `auth.api.getSession`, session rows in `apps/vps/src/db/auth.schema.ts`),
it is simply not applied here.

### Runtime topology

- `apps/vps` runs as `sst.aws.Service` on ECS Fargate (`infra/vps.ts:28`)
- fronted by `sst.aws.ApiGatewayV2` (`infra/vps.ts:62`)
- Postgres via Drizzle
- Cloudflare is DNS only (`sst.cloudflare.dns()`); the `cloudflare/*`
  files under `.sst/platform/` are SST's bundled provider SDK, not usage

### Recent related work

`docs/tweet-nav-navigation-race-fix.md` fixed three defects:

- **A**: `exclude` list sent as a GET query param, ~23KB at 200 slugs,
  against API Gateway v2's hard 8KB header cap. Broke permanently at ~70
  seen tweets. Now a POST payload.
- **B**: three uncoordinated navigation triggers racing. Now serialized
  through a module-scoped fiber (`apps/www/src/lib/navigation-intent.ts`).
- **C**: exclude list read from a stale render closure. Now read at
  execution time.

Defect A is the direct consequence of the client owning history: the
client had no choice but to ship all of it, every time. This spec removes
that requirement structurally rather than by raising a size limit.

## Goals

1. `back` returns the reader to the tweet they came from, however they got
   to this one.
2. `forward` re-walks what they stepped back through, then keeps going into
   unread tweets once the trail runs out. One gesture, no mode to learn.
3. No move ever discards history, and no tweet is ever shown twice by the
   arrows or by random.
4. Random skips what this reader has seen, without the client uploading its
   history each time.
5. State outlives a cleared browser and follows a signed-in reader between
   devices.
6. Anonymous readers keep working. They are most of the traffic.

## Non-Goals

- Cross-device sync for anonymous users. Anonymous sessions are per-device
  by construction, since the identity is a device cookie.
- Migrating pre-existing `localStorage` history. Everyone starts fresh at
  cutover (Decision 2).
- Live cross-tab updates. Tabs share a cursor but do not push to each
  other; see "On shared cursors and sync engines".
- Changing what `getAdjacentMicroPosts` returns. It keeps its current
  behaviour and becomes an internal detail: it is how we find the next
  unread tweet once forward runs out of trail, not something the reader
  aims at directly.
- Guaranteeing every reader the same route through the tweets. Two readers
  who have read the same tweets may have reached them in different orders,
  and that is fine.
- Replacing the browser back button, or writing our own
  `history.pushState` entries. We do not manage browser history; we make
  our trail agree with it. See "The browser back button".
- Recommendation/personalization beyond "exclude what I have seen."
- Applying any of this to editorial posts, shows, or audio.

## Invariants

What the server must always hold true. Each one has a test.

1. **The trail only grows, and only at the end.** Nothing is ever removed
   by a move. The only removals are the size cap dropping the oldest
   entries, and a deleted tweet disappearing (rule 7).
2. **The cursor stays in range.** `0 <= cursor < trail.length`, or the
   trail is empty and there is no cursor.
3. **`Step(Back)` only ever replays.** It returns an earlier trail entry or
   says there is none. It never reaches for a new tweet.
4. **Repeating a move changes nothing.** The same intent token twice must
   not move the cursor twice.
5. **Nothing is added to the trail twice.** A tweet already in the trail is
   never appended again, so `Step(Forward)` past the end and `Jump` both
   skip anything already there.
6. **Arrows only add at the end.** `Step(Forward)` may add a tweet only
   when the cursor is at the last entry. From anywhere else it replays, so
   a reader walking their own history cannot cause a write. `Open` is the
   exception and may append from anywhere, since an external link can
   arrive at any time; it still appends at the end, never at the cursor.
7. **A deleted or drafted tweet must not break the trail.** Skip it and
   keep going in the same direction. Never show a 404.

Rules 1, 5 and 6 together are what make the arrows safe: no move destroys
history, no tweet repeats, and moving through your own past never changes
it.

Rule 7 is what produced the 404 screenshot. It has to be a rule we hold,
not an error we handle.

## Design Constraints

- Effect 4.0.0-beta.99. `HttpApiEndpoint`/`HttpApiGroup`, Effect `Schema`,
  typed error channels. Note `Effect.catchCause` (not `catchAllCause`) and
  `Exit.hasInterrupts` (not `Exit.isInterrupted`).
- `Schema.brand` for `Slug` is a **new pattern in this repo**. Grepped
  `packages/api/src` and `apps/vps/src`: zero existing uses of
  `Schema.brand` or hand-rolled branded types. It is the right call for a
  value that flows through every layer of this feature, but it is a
  convention being introduced here, not one being followed. If that is
  unwanted, `Schema.String` works and the spec loses only compile-time
  protection against passing an arbitrary string as a slug.
- Drizzle. This repo uses **camelCase column names in the database**
  (`"showId"`, `"createdAt"`), unlike the general convention. Confirmed by
  a failing prod query during earlier work.
- Prod migrations use `drizzle migrate`, never `push`
  (`docs/migration-ledger.md`). Migrations get applied only to disposable
  test DBs during development.
- API Gateway v2: 8,192-byte hard cap on request line plus headers. Any
  design that puts history in a URL or a cookie is disqualified. This is
  what broke prod.
- Live production app. Rollout must be additive and reversible.
- No `as any`, avoid type assertions.

## The Design, and What We Turned Down

**Settled: the server keeps the trail and the cursor in Postgres.**

One endpoint, `POST /api/content/posts/micro/navigate`, takes a command and
returns where to go plus which controls to enable. The trail is keyed to an
identity that covers both signed-in readers and anonymous ones. Every kind
of move runs through one code path, so the rules live in one place, and the
client never uploads its history. It costs one round trip per move and one
write.

Three other designs, and why they lost. Recorded so nobody re-opens them
without new information.

**Keep the client in charge, sync to the server as backup.** The smallest
change, and no extra request when moving. But `back` still means
"date-neighbour," because nothing owns a trail. Two writers share one piece
of state with no rule for merging them, so two tabs drift apart quietly.
The client still uploads its seen list on every random pick, so Defect A
survives at a smaller size. It fixes storage, which was never what was
broken.

**A Durable Object per reader.** One object holds the trail in memory and
handles one request at a time, so the read-then-write race cannot happen at
all. Invariants 1, 2 and 4 come free instead of needing a lock. This is the
better fit for the problem, and it lost on where we run, not on merit.
`apps/vps` runs on ECS Fargate behind API Gateway v2 (`infra/vps.ts`), and
Cloudflare only serves DNS (`sst.cloudflare.dns()`). Taking this route
means running a second platform for one feature: another thing to deploy,
another place to read logs, a hop from AWS to Cloudflare on every move, and
two stores that can disagree, since Postgres holds everything else. A row
lock and a unique index buy the same guarantees where we already are. Worth
revisiting if the app moves to Workers for other reasons. Not worth moving
for this alone.

**A signed token in the request holding the whole trail.** No database, no
identity problem. But the token grows with the trail, and at ~114-character
slugs it hits the same 8KB ceiling that took prod down, within a few dozen
entries. It also cannot follow a reader across devices, which we want.
Rejected: it rebuilds the failure we just fixed.

## Proposed Design

One endpoint owns navigation. The client sends **intent**, not
destinations.

```
POST /api/content/posts/micro/navigate
  { command: NavigationCommand, from: Slug, intentToken: IntentToken }
  -> NavigationResult
```

The client never computes a destination, never sends a history, and never
decides whether `back` is legal. It renders `result.capabilities` to
enable/disable controls and navigates to `result.destination`.

Sequential `older`/`newer` remain chronological, exactly as today, but now
also **append to the trail**, which is what unifies the two coordinate
systems: chronological movement is a way of _choosing_ the next post, while
the trail is the record of _where the user actually went_. `back` walks the
trail. `older`/`newer`/`random` extend it.

### How the arrows behave

**The arrows always mean back and forward through your own reading.**
Nothing else. They never destroy anything.

An earlier draft had the arrows do double duty: back/forward inside your
history, and step-by-date once you were at the end. Reconciling the two
needed a rule where tapping an arrow silently dropped tweets you had
already read. That rule was correct in the sense that it kept the data
tidy, and wrong in every way that matters. An arrow you are already tapping
should not quietly throw away your history.

So there is one rule now:

**The trail only ever grows, and only ever at the end.**

Walk it. `>` marks where you are.

```
1. Read "coltrane", tap forward twice.
   trail: [coltrane, dilla, madlib >]

2. Hold for random, land on "bjork".
   trail: [coltrane, dilla, madlib, bjork >]

3. Tap back.
   trail: [coltrane, dilla, madlib >, bjork]
   You moved. Nothing was removed.

4. Tap back again.
   trail: [coltrane, dilla >, madlib, bjork]

5. Tap forward.
   trail: [coltrane, dilla, madlib >, bjork]
   Exactly where step 3 left you.

6. Tap forward twice more.
   trail: [coltrane, dilla, madlib, bjork >]
   You are at the end of everything you have read.

7. Tap forward again. There is no next tweet in the trail,
   so we step by date instead and add what we find.
   trail: [coltrane, dilla, madlib, bjork, stereolab >]

   Nothing was lost. Back still walks all the way home.
```

Step 7 is the whole design. Forward inside your history is a replay;
forward past the end of it is a new tweet. Both are the same gesture,
because from the reader's side they are the same intent: _show me the next
thing._ The reader never has to know which one they just did.

**Falling off the end skips what you have read.** The date step at step 7
skips any tweet already in the trail. If `stereolab` were already in there,
we keep walking back through the dates until we reach one that is not.
That is what stops the arrows from marching you through tweets you just
saw by another route.

A consequence worth stating plainly, because it is a choice and not an
accident: two readers who have seen the same tweets can reach them in
different orders, and one reader's path is their own. We are not trying to
give everyone an identical tour. We are trying to make sure nobody is shown
the same tweet twice and nobody loses their place.

## Domain Model and Types

### Three commands

Once the arrows only ever walk the trail, the earlier `Travel` / `Visit`
split disappears. The client no longer decides whether a tap is a replay or
a new tweet, because it cannot know: that depends on where the cursor sits
in a trail the server owns. The client sends the gesture. The server works
out what it means.

```ts
export const Slug = Schema.String.pipe(Schema.brand("MicroPostSlug"));
export type Slug = typeof Slug.Type;

export type NavigationCommand =
  | { readonly _tag: "Step"; readonly direction: "Back" | "Forward" }
  | { readonly _tag: "Jump" }
  | { readonly _tag: "Open"; readonly slug: Slug };
```

- **`Step`** is an arrow tap. Back always replays. Forward replays while
  there is trail ahead, and past the end it picks the next unread tweet by
  date and adds it.
- **`Jump`** is hold-for-random. It picks an unread tweet at random and
  adds it at the end.
- **`Open`** is arriving by link, by URL, or by the browser's own back and
  forward buttons. If the slug is already in the trail it moves the cursor
  there and adds nothing. Otherwise it appends at the end. This is what
  keeps the browser's back button and ours pointing the same way; see "The
  browser back button".

All three add at the end when they add at all. None of them ever removes
anything. That is rule 1, and it is now enforced in one place rather than
being restated per command.

```ts
export type TrailEntry = {
  readonly slug: Slug;
  readonly postId: string;
  readonly visitedAt: number;
  readonly arrivedBy: "Step" | "Jump" | "Open";
};
```

`arrivedBy` records how a tweet first entered the trail. It has no effect
on movement, and exists for spotting patterns later.

The picker is the only part that touches content:

````ts
Only one part reaches for a tweet the reader has not seen, and only
`Step(Forward)` past the end and `Jump` ever call it:

```ts
export type UnreadPick = 'NextByDate' | 'Random'

export interface UnreadFinder {
  readonly find: (
    pick: UnreadPick,
    from: Slug,
    seen: ReadonlySet<Slug>
  ) => Effect.Effect<ResolvedDestination, CorpusExhausted | DatabaseError>
}
````

Both cases take `seen` and must return something outside it. That is the
same requirement, so it lives in one place. `NextByDate` walks back through
the dates until it finds an unread tweet; `Random` picks one at random.
Adding a third way to find an unread tweet later (within a tag, by an
author) is one more variant here and touches no trail logic.

**The capability flags shrink too.** With one pair of arrows there are only
two questions worth answering, plus whether there is anything left to read:

```ts
export type NavigationCapabilities = {
  readonly canStepBack: boolean;
  readonly canStepForward: boolean;
  readonly hasUnread: boolean;
};
```

`canStepForward` is true when there is trail ahead **or** unread tweets
remain, since the reader cannot tell those apart and should not have to.
It goes false only at the true end: nothing ahead, nothing unread.

### On the naming

The code calls the date directions `prev` and `next`, which sound like
history and is why "press prev after a random" felt broken. Those names now
describe something the reader never addresses directly: stepping by date is
what happens when forward runs out of trail, not a button anyone presses.
`back` and `forward` are the only words left facing the reader, and they
mean what they say.

```ts
export type NavigationResult = {
  readonly destination: { readonly slug: Slug; readonly postId: string };
  readonly capabilities: NavigationCapabilities;
  readonly trailPosition: { readonly index: number; readonly length: number };
};

export type NavigationSession = {
  readonly id: string;
  readonly identity: NavigationIdentity;
  readonly trail: readonly TrailEntry[];
  readonly cursor: number;
  readonly seenSlugs: ReadonlySet<Slug>;
};
```

`trail` and `seenSlugs` look like duplicates now that nothing truncates,
and they must not be merged. The trail is capped at 500 and drops its
oldest entries; the seen set is uncapped and forgets nothing. Derive "have
I read this?" from the trail and a reader who passes 500 tweets starts
being shown old ones again. Keep both:

- `trail` answers **where was I, and in what order** (bounded)
- `seenSlugs` answers **have I read this** (unbounded)

Every append writes to both. Only the trail evicts.

```ts
export type NavigationIdentity =
  | { readonly _tag: "User"; readonly userId: string }
  | { readonly _tag: "Anonymous"; readonly deviceToken: string };
```

Errors are typed and distinct from HTTP concerns:

```ts
export class NoSuchMove extends Schema.TaggedErrorClass<NoSuchMove>()(
  "NoSuchMove",
  { command: Schema.String },
) {}

export class TrailEntryGone extends Schema.TaggedErrorClass<TrailEntryGone>()(
  "TrailEntryGone",
  { slug: Schema.String },
) {}

export class CorpusExhausted extends Schema.TaggedErrorClass<CorpusExhausted>()(
  "CorpusExhausted",
  {},
) {}
```

`NoSuchMove` is a legitimate outcome, not a failure. It should be
unreachable in a correct UI because `capabilities` disables the control,
but it must be typed for the racing/stale-capability case.

## Types, Interfaces, and APIs

```ts
export interface NavigationSessionService {
  readonly resolve: (
    identity: NavigationIdentity,
    command: NavigationCommand,
    from: Slug,
    intentToken: IntentToken,
  ) => Effect.Effect<
    NavigationResult,
    NoSuchMove | CorpusExhausted | DatabaseError,
    never
  >;

  readonly reset: (
    identity: NavigationIdentity,
  ) => Effect.Effect<void, DatabaseError>;
}
```

There is deliberately no `recordVisit`. The earlier draft had one, but
after the remodel it is just `resolve` with an `Open` command, and a
second write path into the trail is exactly how the two-writer problem
from the current `localStorage` design would come back.

Pure core, separately testable, no DB:

```ts
export const applyCommand: (
  session: NavigationSession,
  command: NavigationCommand,
  resolved: Option<ResolvedDestination>,
) => Result<NavigationSession, NoSuchMove>;

export const capabilitiesOf: (
  session: NavigationSession,
  corpus: CorpusFacts,
) => NavigationCapabilities;
```

`applyCommand` is where invariants 1 through 4 live. It is a pure function
over a value; every invariant test targets it directly with no database.
`resolved` is empty on a replay, which has no new destination and only
moves the cursor.

`capabilitiesOf` takes `CorpusFacts` (whether an older/newer post exists,
whether the corpus is exhausted) as a separate argument rather than
reading them itself, because those are content facts and the pure core
must not query. The service supplies them from the phase-1 read.

New endpoint (public, with optional auth, see Seams):

```ts
HttpApiEndpoint.post(
  "navigateMicroPosts",
  "/api/content/posts/micro/navigate",
  {
    payload: NavigateInput,
    success: NavigationResultResponse,
    error: [
      HttpApiError.NotFound,
      HttpApiError.Conflict,
      HttpApiError.InternalServerError,
    ],
  },
);
```

**Delete both old endpoints in the same release.** `getRandomMicroPost`
(`packages/api/src/post.ts:284`) and `getAdjacentMicroPosts` (`:298`) go,
along with their handlers in `post.handlers.ts:170` and `:182`, and the
`useRandomMicroPost` / `useAdjacentMicroPosts` hooks in `http.ts:416` and
`:436`.

An earlier draft kept them for a release and deprecated them later. That
contradicted the hard-cutover decision: keeping them means the old path
still works, which is a flag by another name. Grepping for callers shows
`TweetNav.tsx` is the only one, and this spec rewrites it. Nothing else in
the repo calls either endpoint, and neither is a public API anyone outside
the app depends on.

**Keep the service functions.** `getAdjacentMicroPostsEffect`
(`post.service.ts:597`) and `getRandomMicroPostEffect` (`:676`) stay
exactly as they are. `UnreadFinder` calls them to step by date and to pick
at random. What goes away is the ability for a client to reach them
directly; the logic itself is still how we find an unread tweet.

### Persistence

```ts
export const navigationSessions = pgTable(
  "navigation_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("userId").references(() => user.id, { onDelete: "cascade" }),
    deviceToken: text("deviceToken"),
    cursor: integer("cursor").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("navigation_sessions_user_uq").on(t.userId),
    uniqueIndex("navigation_sessions_device_uq").on(t.deviceToken),
  ],
);

export const navigationTrailEntries = pgTable(
  "navigation_trail_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("sessionId")
      .notNull()
      .references(() => navigationSessions.id, { onDelete: "cascade" }),
    postId: uuid("postId")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    position: integer("position").notNull(),
    arrivedBy: text("arrivedBy").notNull(),
    visitedAt: timestamp("visitedAt").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("navigation_trail_session_position_uq").on(
      t.sessionId,
      t.position,
    ),
  ],
);
```

Note the FK on `postId` with `onDelete: 'cascade'`. This is what makes
invariant 7 hold structurally rather than by defensive coding: a deleted
post removes its trail entries. Positions then have gaps, so trail reads
must re-sequence by `position` ordering rather than trusting contiguity.
Drafting a post is not a delete, so the read path must also filter
`draft = false` and treat a filtered entry as `TrailEntryGone`.

Column names are camelCase to match this repo's existing convention.

### Hot-path indexing

This is the hot path, so the index plan is part of the contract, not a
tuning detail. Every navigation runs exactly two lookups:

1. identity -> session row
2. session -> trail entries, ordered by `position`

Both are covered above, but only if read the right way:

- `navigation_sessions_user_uq` on `userId` and
  `navigation_sessions_device_uq` on `deviceToken` make lookup 1 a unique
  index scan. These are the `FOR UPDATE` target, so the lock is taken via
  an index probe, not a scan.
- `navigation_trail_session_position_uq` on `(sessionId, position)` makes
  lookup 2 an ordered range scan on the leading column. Because `position`
  is the second column, `ORDER BY position` is satisfied by the index with
  no sort step.

Both unique indexes must be **partial**, because `userId` and
`deviceToken` are each null for the other identity kind, and Postgres
treats nulls as distinct in a plain unique index (so it would happily
allow many rows with `userId IS NULL`, defeating the constraint for
anonymous rows):

```sql
CREATE UNIQUE INDEX navigation_sessions_user_uq
  ON navigation_sessions ("userId") WHERE "userId" IS NOT NULL;
CREATE UNIQUE INDEX navigation_sessions_device_uq
  ON navigation_sessions ("deviceToken") WHERE "deviceToken" IS NOT NULL;
```

Trail reads must be bounded. With the cap in place a trail is at most a few
hundred rows, but `back`/`forward` only need the neighbouring entries, so
the service should read a window around the cursor rather than the whole
trail. Loading the full trail on each navigation is the obvious accidental
regression here and should be caught in review.

`FOR UPDATE` locks only the single `navigation_sessions` row, and the lock
is per identity, so contention is limited to one user's own concurrent
navigations, which is exactly the serialization we want. It does not
serialize across users.

One caveat worth stating: `Older`/`Newer` still delegate to
`getAdjacentMicroPosts`, and `Random` to `getRandomMicroPost`, both of
which run their own queries **inside** the transaction that holds the row
lock. Keep those queries out of the lock window where possible (resolve
the destination first, then open the transaction to apply it), or the lock
is held for the duration of a content query.

## Who Owns What

| Part                       | Job                                                             | Must not know                       |
| -------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| `navigate` handler         | read the payload, work out who is asking, turn errors into HTTP | how the trail works                 |
| `NavigationSessionService` | run the transaction, load, apply, save                          | HTTP, cookies                       |
| `applyCommand` (pure)      | rules 1 to 4                                                    | the database, the clock, randomness |
| `PostService`              | date neighbours, random pick, hiding drafts                     | trails, cursors, readers            |
| `IdentityResolver`         | signed-in session or anonymous device token                     | what the commands mean              |

**Identity is the piece everything else rests on.** `AuthMiddleware`
(`apps/vps/src/middleware/auth.impl.ts`) returns 401 when there is no
session, so we cannot put it on a public endpoint. We need a resolver that
returns a `User` when better-auth has a session and `Anonymous` otherwise.

```ts
export interface IdentityResolver {
  readonly resolve: Effect.Effect<NavigationIdentity, never, HttpServerRequest>;
}
```

The anonymous device token is an `httpOnly` cookie the server sets, holding
a random id and nothing else. It must never hold the trail. The 8KB ceiling
covers cookies too, and that ceiling is what took prod down. **The size of
a trail must never affect the size of a request header.** That rule binds
any later change here.

## Call Stacks and Data Flow

### Current flow (random)

```
HoldToRandomButton onHoldComplete
  -> runNavigationIntent (module-scoped fiber, interrupts prior)
  -> randomMicroPostEffect(slug)          apps/www/src/lib/http.ts
  -> readTweetBrowseState().seenSlugs     localStorage read at exec time
  -> POST /posts/micro/random { exclude: [...200 slugs] }
  -> getRandomMicroPostEffect(excludeSlugs)
  -> notInArray(postsTable.slug, excludeSlugs)
  -> { slug }
  -> router.navigate
  -> $slug.tsx useEffect -> recordViewed -> localStorage write
```

### Current flow (prev/next)

```
TweetNav goToPrev
  -> useAdjacentMicroPosts(slug) cached result
  -> router.navigate({ slug: prev.slug })
```

Note these two paths share no state and no ordering concept. That is the
defect.

### Proposed flow (all commands, one path)

```
UI control (tap | hold | hotkey)
  -> runNavigationIntent(...)                 existing fiber serialization, kept
  -> navigateEffect({ command, from, intentToken })
  -> POST /api/content/posts/micro/navigate
      -> parse payload            NavigateInput (Schema)
      -> IdentityResolver.resolve -> NavigationIdentity
      -> NavigationSessionService.resolve

          phase 1: read, no lock held
          -> load session + trail window around cursor (indexed, no FOR UPDATE)
          -> is this a replay?
               Step(Back)                  -> yes, if cursor > 0
               Step(Forward), cursor < end -> yes
               Open(slug already current)  -> yes, no-op
               otherwise                   -> no

          replay path: cursor move only, NO WRITE AT ALL
          -> return trail[cursor -/+ 1] and new capabilities
          -> done. No transaction, no lock, no content query.

          new-tweet path: only reachable at the end of the trail
          -> UnreadFinder.find(pick, from, seen):
               Step(Forward) -> NextByDate, skipping anything in seen
               Jump          -> Random, skipping anything in seen
               Open          -> PostService.getMicroPostBySlug(slug)
          -> BEGIN
          -> re-read session row (SELECT ... FOR UPDATE, unique index probe)
          -> if intentToken already applied -> COMMIT, return prior result (rule 4)
          -> if the trail grew since phase 1 -> COMMIT, retry once from phase 1
          -> applyCommand(session, command, resolved)   pure, rules 1 to 6
          -> append to trail + seen, move cursor
          -> COMMIT
      -> capabilitiesOf(session)
      -> NavigationResult
  -> router.navigate({ to: '/tweet/$slug', params: { slug: destination.slug } })
```

**Replays never write.** This is the payoff of dropping truncation. `back`
and most `forward` taps are a bounded indexed read and nothing else: no
transaction, no row lock, no content query. Only walking past the end of
the trail costs a write, and that happens once per tweet a reader has never
seen. The earlier draft wrote on every move, because any move could
truncate.

The `FOR UPDATE` lock still guards the append path, so two devices
appending at once cannot both claim the same end position. Replays skip it
entirely, which also means a reader flicking back through history cannot
contend with themselves.

Type flow:

```txt
raw JSON body
  -> NavigateInput (Schema)             boundary parse, rejects unknown commands
  -> NavigationCommand                  canonical domain input
  -> NavigationSessionService.resolve   application seam
  -> Drizzle rows                       persistence DTO
  -> NavigationSession                  domain value
  -> applyCommand                       pure transition
  -> NavigationResult                   response projection
  -> serialized JSON
```

### Failure flow

| Condition                                  | Typed error       | HTTP     | UI                                        |
| ------------------------------------------ | ----------------- | -------- | ----------------------------------------- |
| `Step(Back)` at the start of the trail     | `NoSuchMove`      | 409      | arrow was already disabled; ignore        |
| `Step(Forward)` at the end, nothing unread | `CorpusExhausted` | 409      | arrow disabled, reader is fully caught up |
| trail entry deleted or drafted             | `TrailEntryGone`  | internal | skip it, keep going the same way          |
| `Jump` with nothing unread                 | `CorpusExhausted` | 409      | hold gesture does nothing, same as above  |
| `Open` slug not found                      | `NotFound`        | 404      | error boundary                            |
| DB failure                                 | `DatabaseError`   | 500      | retry once, then error boundary           |

`TrailEntryGone` never reaches the client. It is handled inside `resolve`
by skipping and continuing. Invariant 7.

`CorpusExhausted` no longer recycles the seen set. Under the old model the
seen set only fed random picks, so wrapping around was harmless. Now it
also drives `Step(Forward)`, and recycling would march a caught-up reader
back through tweets they had already read, which is exactly what rule 5
forbids.

So "you have read everything" is now a real end state: `canStepForward`
goes false, and `hasUnread` is false. `Step(Back)` still works, so the
reader can walk their history. New tweets get posted, and the arrow comes
back on its own.

This is a genuine product change worth noticing. Readers who exhaust the
corpus previously got endless random repeats. Now they hit a wall. That is
more honest, and it is the direct consequence of the arrows being trusted
never to repeat a tweet.

### Retry / cancellation / idempotency flow

- The existing module-scoped intent fiber
  (`apps/www/src/lib/navigation-intent.ts`) stays. It is still needed: this
  endpoint is async and superseding taps must still cancel in-flight
  requests. `FetchHttpClient` propagates fiber interruption into
  `AbortSignal`, so an interrupted intent genuinely aborts the request.
- An aborted request may still have committed server-side. That is why
  `intentToken` exists: a client-generated id per user gesture, stored with
  the session, so a retry or a duplicate replays rather than re-advances
  (invariant 4).
- Client retry policy: one retry on 5xx. Never retry on `NoSuchMove`.

### Observability flow

Follow existing `Effect.withSpan` usage in `post.service.ts`:

```ts
Effect.withSpan("navigation.resolve", {
  attributes: {
    command: command._tag,
    identityKind: identity._tag,
    trailLength,
    cursor,
  },
});
```

Do not put slugs or user ids in span attributes. Emit a counter for
`CorpusExhausted` and for `TrailEntryGone` skips; a rising `TrailEntryGone`
rate is the early signal that trail integrity is degrading.

## Files to Add / Change / Delete

### Add

| File                                               | Owns                                   |
| -------------------------------------------------- | -------------------------------------- |
| `apps/vps/src/db/navigation.schema.ts`             | two tables above                       |
| `apps/vps/src/domain/navigation.ts`                | `applyCommand`, `capabilitiesOf`, pure |
| `apps/vps/src/domain/navigation.test.ts`           | invariant tests, no DB                 |
| `apps/vps/src/services/navigation.service.ts`      | transaction boundary                   |
| `apps/vps/src/services/navigation.service.test.ts` | persistence semantics                  |
| `apps/vps/src/http/navigation.handlers.ts`         | HTTP mapping                           |
| `apps/vps/src/middleware/optional-auth.impl.ts`    | `IdentityResolver`                     |
| `packages/api/src/navigation.ts`                   | endpoint + schemas                     |
| `apps/www/src/lib/navigation-commands.ts`          | client effects per command             |
| `drizzle/NNNN_navigation_sessions.sql`             | migration                              |

### Change

| File                                    | Change                                                |
| --------------------------------------- | ----------------------------------------------------- |
| `packages/api/src/api.ts`               | register navigation group                             |
| `apps/vps/src/http/routes.ts`           | wire handlers + layer                                 |
| `apps/www/src/components/TweetNav.tsx`  | commands instead of destinations; render capabilities |
| `apps/www/src/routes/tweet/$slug.tsx`   | `Direct` visit instead of local record                |
| `apps/www/src/lib/http.ts`              | add navigate hook                                     |
| `apps/www/src/routes/tweet/-landing.ts` | resume from server session                            |

### Delete (all in the cutover release)

| File | Note |
| --- | --- |
| `apps/www/src/store/tweetSeen.ts` | Delete outright. Anonymous readers get server sessions, no history is imported, and there is no flag to fall back to. Its `localStorage` key is abandoned, not migrated. |
| `packages/api/src/post.ts:284,298` | Remove the `getRandomMicroPost` and `getAdjacentMicroPosts` endpoint definitions. |
| `apps/vps/src/http/post.handlers.ts:170,182` | Remove both handlers. |
| `apps/www/src/lib/http.ts:416,436` | Remove `useAdjacentMicroPosts` and `useRandomMicroPost`. |

Nothing here waits for a second release. `TweetNav.tsx` is the only caller
of any of it, and this spec rewrites that file.

The service functions `getAdjacentMicroPostsEffect` and
`getRandomMicroPostEffect` (`post.service.ts:597`, `:676`) are **not**
deleted. `UnreadFinder` calls them.

Keep `apps/www/src/lib/navigation-intent.ts`. It solves client-side
supersession, which this spec does not replace.

## RGR TDD Test Plan

Vertical slices. Each is one failing test, then minimal code.

**Slice 1 to 6, pure domain, no DB.** These are the highest-value tests and
should all exist before any persistence work.

1. Red: `Step(Back)` on cursor 0 returns `NoSuchMove`. (Rule 3)
2. Red: `Step(Back)` on cursor 2 moves the cursor to 1 and leaves the trail untouched. (1, 2)
3. Red: `Step(Forward)` after `Step(Back)` returns to the entry it started from.
4. Red: **`Step(Forward)` from a rewound cursor replays and never appends.** This is the annotation that caused the remodel. Walk back three entries, step forward, and assert the trail is byte-identical and no tweet was added. (1, 6)
5. Red: replaying the same `intentToken` does not move the cursor twice. (4)
6. Red: `capabilitiesOf` reports `canStepForward: true` when the cursor is mid-trail, true at the end while unread tweets remain, and false only when at the end with nothing unread.
   6a. Red: `Step(Forward)` at the end and `Jump` both append at the end and leave earlier entries untouched. Same trail mutation, different picks. (1)
   6b. Red: a tweet already in the trail is never appended a second time, by either `Step(Forward)` or `Jump`. (5)
6c. Red: appending to a full 500-entry trail drops the oldest entry, leaves `seenSlugs` untouched, and keeps the cursor pointing at the same tweet it did before. The evicted tweet is still never re-offered by `Step(Forward)` or `Jump`, because `seenSlugs` still holds it.

**Slice 7 to 10, service with a real test DB.** Never against prod.

7. Red: concurrent `resolve` calls for one identity serialize; final cursor is correct, not lost-update.
8. Red: a trail entry whose post was deleted is skipped, and `back` lands on the next valid entry. (7)
9. Red: a trail entry whose post became `draft` is treated as gone. (7)
10. Red: a reader with nothing unread gets `CorpusExhausted` from both `Step(Forward)` and `Jump`, and the seen set is NOT recycled. (5)
    10a. Red: a cursor that changed between phase 1 and phase 2 causes exactly one retry, and the result reflects the newer cursor. Guards the read/lock split.
    10b. Red: `EXPLAIN` on the session lookup and the trail-window read uses the unique indexes, with no sequential scan and no sort step. Cheap regression guard on the hot path.

**Slice 11 to 13, HTTP blackbox**, following the existing pattern in
`apps/vps/src/http/routes.blackbox.test.ts`.

11. Red: `navigate` with no auth creates an anonymous session and sets the device cookie.
12. Red: `navigate` with a valid session uses the user identity and ignores the device cookie.
13. Red: an unknown `command._tag` or an unknown `picker._tag` is rejected at the schema boundary with 4xx, not a 500.
    13a. Red: an `Open` whose slug already equals `trail[cursor]` is a no-op: cursor unchanged, no duplicate entry, no write.
    13c. Red: an `Open` for a slug earlier in the trail moves the cursor back to that entry, appends nothing, and truncates nothing. This is browser back, and it must land where our own back would.
    13d. Red: our `back` followed by browser back returns the reader to where they started, not one step further forward. The two buttons agree.
    13e. Red: an `Open` for a slug not in the trail appends at the end, even when the cursor is mid-trail. This is the evicted-entry case and a plain external link.
    13b. Red: `Open` followed immediately by `Step(Back)` returns the prior tweet, never `NoSuchMove`. This is the race that recording in the background would have introduced.

**Slice 14, client.**

14. Red: superseded navigation intent aborts its in-flight request and does not navigate. Extends the existing `navigation-intent.test.ts` coverage.

Not unit tested, per project convention: route files and handler files are
covered by blackbox/integration tests instead.

## Risks and Open Questions

### Risks

- **Every move now writes.** Reading a tweet becomes a transaction holding
  a row lock. At today's traffic that is fine, but browsing now depends on
  the database accepting writes, where before it needed only reads. See
  "Direct visits wait" for why the obvious dodge does not work.

- **Anonymous rows pile up.** One per device, forever. **Decided: sweep
  them with `infra/cron.ts`**, reusing the cron we already run. Delete
  `navigation_sessions` rows with no `userId` whose `updatedAt` is more
  than **30 days** old; trail entries follow through the foreign key. Rows
  tied to a `userId` are left alone, since they disappear with the account.

- **Cutover. Decided: switch over in one go, no flag.** `tweetSeen.ts` and
  its `localStorage` key go in the same release that ships the endpoint.
  Everyone starts empty, so there is nothing to migrate and nothing for a
  flag to fall back to. The real cost: a bad deploy needs a revert, not a
  switch. Acceptable, because only tweet navigation is at stake, and
  because a flag means shipping both engines and keeping both alive, which
  Decision 1 already turned down.

- **Speed. Prefetching ships with it, not after.** A replay reads the
  trail, queries no content and writes nothing, so it should be quick, but
  it is still a round trip where today there is none. Two things, both in
  the first build:
  1. The response includes the slugs either side of the new cursor, so the
     client can warm the router loader for the likely next move.
  2. Capability flags render from the client's last known position, so
     buttons do not flicker while the request is out.

  Prefetch must only warm the loader. It must never call `navigate`, or
  prefetching would move the cursor by itself. Worth watching for in
  review.

### Decisions (settled in review)

1. **Anonymous readers get server sessions too. One mechanism.** Keeping
   `localStorage` for anonymous readers and trails for signed-in ones means
   building navigation twice, holding two sets of rules, and changing
   behaviour the moment someone logs in. The `back` fix would work for some
   readers and not others, and every bug report would open with "were you
   signed in?" The price is one cookie and one row per device, which is
   small beside running two engines. Old anonymous rows get swept (see
   Risks).

2. **No import of old `localStorage` history. Everyone starts empty.** At
   cutover every reader gets an empty trail and an empty seen set.
   `seenSlugs` records no order, so any trail built from it would be
   invented. The import code would be written once, hard to test, and
   permanently in the way. The price: a reader may see one tweet twice.

3. **Trail holds 500 entries, oldest dropped first.** The seen set stays
   uncapped, since it holds only ids and grows slowly. Dropping the oldest
   entries means very old `back` steps stop working, which is what browsers
   do anyway.

4. **Tabs share one cursor.** The session belongs to the reader, not the
   tab. See the note below.

5. **`older` and `newer` add to the trail**, as first written. Kept not
   because the confusion risk is gone but because the alternative is worse:
   if date moves did not add, `back` after a run of `older` taps would jump
   over everything the reader just walked through, which is the same
   surprise this whole spec exists to kill. The rename is the guard. Worth
   a prototype, not a redesign.

6. **`lastViewed` moves to the server and stops being its own idea.** It is
   `trail[cursor]`. `-landing.ts` reads the resume point from the session
   instead of the local atom, and `useRecordTweetViewed`'s double write
   becomes one `Open`.

### On shared cursors and sync engines

Sharing a cursor between tabs does lean toward sync-engine work, and this
is where the design could quietly grow far past what we want. So draw the
line now.

What a shared cursor needs is small: the server holds the truth, and
clients read it rather than trusting their own copy. The phase 1 / phase 2
re-check covers writing, and every response carries fresh capability flags.
A second tab finds out the cursor moved the next time it moves.

What it does **not** need, and what we are leaving out:

- **Live push.** No websockets, no polling. Tab B learns nothing about tab
  A until tab B moves. Stale buttons in a background tab are fine, and
  `NoSuchMove` exists so that clicking one fails cleanly instead of
  corrupting the cursor.
- **An offline queue.** Moving requires the server.
- **Merge rules.** The cursor is one number under a row lock. There is
  nothing to merge.

Hold this line: the server owns the state, the client guesses ahead for
speed. This is not a copy of the data living on the client. If someone
later wants tab B to update by itself, that is a sync engine and needs its
own spec. It is not a small addition to this one, and it must not arrive
disguised as an implementation detail.

### Direct visits wait

The question: when someone opens a tweet link, should the server record it
in the background so the page loads sooner?

**Decided: it waits, like every other `Visit`.**

An earlier draft said record it in the background. That is wrong, and
the remodel is what shows why: `Open` appends at the end exactly like a
forward step past the trail. Record it in the background and this happens:

```
1. User opens /tweet/coltrane directly.   Direct visit fires, not awaited.
2. Reader immediately taps back.          Step(Back) arrives first.
3. Server: trail is still empty.          NoSuchMove.
4. The Direct write lands.                Trail now [coltrane], cursor 0.
```

The reader pressed back on a page that had already loaded, got nothing, and
then the thing they needed turned up a moment later. Worse, it only breaks
if they tap fast, so it shows up now and then and looks like a bug in
`Step` rather than a decision about `Open`.

Waiting costs a write on page load, the risk listed above. In its favour:
the write is one indexed row plus one insert, the same shape as every other
move, and it only happens on tweet pages. If it ever does slow things down,
make every navigation write cheaper. Do not let one command claim it
finished when it has not.

One fair shortcut: if the incoming slug already matches `trail[cursor]`,
this is a refresh, so skip the write after the read. That covers the common
repeat without making anything wait in the background.

### The browser back button

There are two back buttons on the screen and they must not disagree.

Every move calls `router.navigate` (`TweetNav.tsx:141`), which pushes a
browser history entry. So the browser already keeps its own record of the
URLs a reader passed through, and pressing browser back re-runs the `$slug`
loader, which fires `Open`.

Left alone, that breaks:

```
trail: [coltrane, dilla, madlib >]

Tap our back      cursor -> dilla, URL -> /tweet/dilla
Press browser back  URL -> /tweet/madlib, loader fires Open(madlib)
```

Rule 5 stops `madlib` being added twice, so the trail survives. But the
cursor would land on `madlib`, meaning the browser's back button moved the
reader **forward** through their trail. Two controls, opposite directions,
same screen.

**The rule: `Open` on a slug already in the trail moves the cursor to that
entry. It never appends and never truncates.**

That single sentence makes them agree. The browser's history and our trail
hold the same tweets in the same order, because every entry in one got
there through a move that wrote the other. Browser back walks to the
previous URL, which is the previous trail entry, which is what our back
does. The reader can use either and get the same result.

Where they legitimately differ:

- **Browser back can leave the tweet reader entirely**, to whatever page
  came before it. Ours cannot, and should not.
- **Browser forward after a browser back** replays a URL, fires `Open`,
  and moves the cursor forward. Same outcome as our forward while there is
  trail ahead. At the end of the trail they part company: our forward
  fetches an unread tweet, the browser's does nothing, because the browser
  has no entry to go to. That asymmetry is correct. The browser is
  replaying what happened; we are deciding what happens next.
- **A trail entry evicted by the 500 cap** may still sit in browser
  history. Pressing browser back to it fires `Open`, the slug is no longer
  in the trail, and it appends at the end as a new visit. Slightly odd, but
  it only bites after 500 tweets in one session, and appending is a safer
  outcome than a 404.

This is the one place the trail is not append-only, so it is worth being
precise: `Open` on a known slug moves the cursor **backward or forward**
without changing the trail's contents. It is a replay, exactly like `Step`,
just addressed by slug rather than by direction. Rules 1 and 5 both hold.

### Settled since the first draft

**Trail eviction is a feature, not a bug.** When the 500-entry cap drops
the oldest entries, those tweets leave the trail but stay in `seenSlugs`,
so the arrows still will not repeat them. What changes is that a reader who
walks all the way back hits the bottom sooner than their true history.

Left alone that is only a loss. But it also means a very old tweet, long
since evicted, becomes reachable again through the browser back button
(see "The browser back button") and through nothing else. Resurfacing old
tweets to a reader who has read 500 of them is a reasonable outcome, not a
defect to design around. No change needed, and no larger cap needed.

**Retention for anonymous sessions: 30 days from last use.** The sweep
deletes `navigation_sessions` rows whose `updatedAt` is older than 30 days
and that have no `userId`; trail entries follow through the foreign key.
Chosen because it is long enough that an occasional reader keeps their
place between visits, and short enough that a device cookie outliving its
session is the common case rather than a surprise. When a swept reader
returns, their cookie no longer matches a row, so they get a fresh empty
trail: the same experience as a new reader, which is the correct outcome
for someone who has not visited in a month. Revisit if readers complain
about losing their place, not before.

**Latency target for a replay: p95 under 150ms, measured after shipping.**
A replay is one indexed read with no lock, no content query and no write,
so this should be comfortable. The number exists to make the prefetch
falsifiable: if p95 sits above it, prefetching is not doing its job and
that is a bug, not a tuning preference. Measure once real traffic exists
rather than guessing at a synthetic target now.

### Remaining open questions

None blocking. Everything above is decided; what is left is measurement
after the fact.

### Deliberately not answered here

Whether this is worth building at all. `docs/tweet-browse-history-plan.md`
listed "no cross-device sync" and "no authenticated server-side history" as
explicit non-goals for the shipped feature. This spec reverses both. The
justification is the `back` semantics gap, not storage or sync, and if that
gap is not worth fixing, none of the rest of this is worth building.
