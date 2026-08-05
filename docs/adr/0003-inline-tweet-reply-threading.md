# ADR-0003: Inline tweet reply threading

## Status

Accepted

## Date

2026-08-06

## Context

Replies could only be written against the top-level tweet. Replying to a reply meant navigating to that reply's own page first, so a conversation could not be followed or continued in place.

The API already supported this: `deriveReplyThreadFields` tracks `parentPostId`, `rootPostId`, and an incrementing `depth`, and `createMicroPostReply` accepts any `parentSlug` whose post is of type `micro`. A reply is itself a `micro` post, so arbitrary nesting was already valid server-side.

The blocker was the client. `tweetReplyComposerAtom` held a single global `isOpen`/`draft`/`musicUrl`, so every composer instance shared one state: opening one would open all of them onto the same draft.

## Decision

Keep threading depth unbounded in the data and cap only its visual nesting.

- Key composer state by parent slug (`slots: Record<slug, ComposerSlot>`) so each composer owns its own open state and draft.
- Render replies recursively through `TweetReplyCard` / `TweetReplyList`, indenting to a maximum of `MAX_NESTED_DEPTH = 2`.
- Past that depth, show "Continue thread" which navigates to the reply's own page instead of indenting further.
- Nested threads stay collapsed until asked for, and expand in place.

No server change.

## Consequences

- Conversations can be read and continued without leaving the page.
- Indentation cannot outgrow a phone viewport; deep chains become navigation rather than nesting.
- Cache invalidation needs no special handling: a nested composer posts against its own slug, which is the same key its list reads from.
- Composer drafts survive collapsing a thread, since slots are cleared on submit or cancel rather than on unmount.
- Each expanded level subscribes its own replies query. Fine at current thread lengths; revisit if threads grow long enough that the request count matters.
