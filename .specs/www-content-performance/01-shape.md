# Shape: WWW content performance

## Key Domain Concepts

- Content detail: the authorized content projection needed to display a mix.
- Public presentation: metadata derived from public content fields, not another full content read.
- Listener state: one user's favorite membership for one audio item.
- Page document: the data required by WWW to render initial HTML or return transition flags.

## Architectural Mistakes

1. A collection API answers a membership question. `loadPublicActionState` pages through favorites to answer whether one audio item is favored. Work grows with the user's collection rather than the page being viewed.
2. Metadata resolution reloads the full content aggregate. `presentationForAudio` calls `getBySlug`, which queries creators/show artwork, renders rich content, and projects labels even though metadata only uses selected fields. `resolveSiteMetadata` also builds a social-card presentation before returning only metadata.
3. WWW owns a serial cross-API workflow. Identity, content, favorite state, and metadata become accumulated waits. Some dependencies are real, but metadata does not intrinsically depend on favorite state.
4. Identity is resolved on multiple HTTP requests for one page. WWW calls get-session, the audio API resolves an optional actor, and favorites uses required-session middleware. API checks are necessary, but the current page boundary does not let one trusted API request own the shared identity and reads.
5. Existing tracing stops at broad service operations. It concealed the cost of separate audio and label reads and pre-service authentication.

## Evidence After Instrumentation

Local anonymous request ID `b6fddfc1-662b-4689-be18-13a0c64700e6`, trace `41dc89d1159f03f5b5ca81c31fa4a77f`, returned HTTP 200 in 1.59 seconds. The content audio query took 833 ms, label projection 200 ms, and rich-content rendering 8 ms. Metadata repeated the audio query at 204 ms and label projection at 218 ms. These measurements identify repeated query boundaries, not SQL execution time alone: each span also includes database-adapter and transport latency.

This request was anonymous. It does not explain the authenticated slow trace or prove that rendering is always cheap.

## Boundaries and Seams

- API owns authorization, data access, and content projection.
- Presentation functions accept an already-loaded, appropriately visible content value and derive metadata. They do not independently load or render the full content body.
- Favorite service provides a user-and-audio-scoped membership read, rather than requiring callers to scan collection pages.
- WWW owns document rendering and navigation flags, not persistence or trusted identity claims.

## High-Level Flow

Near-term, preserve the current endpoints and response behavior:

1. Reproduce authenticated and anonymous requests with targeted spans.
2. Add a target-specific favorite membership read if none exists.
3. Separate presentation projection from content loading; keep public-only semantics explicit.
4. Overlap independent requests with existing cancellation and cookie handling preserved.
5. Measure before considering a larger page endpoint.

If HTTP fan-out and repeated identity checks remain material, introduce a narrow API-owned mix-detail page read:

```text
WWW request
  -> API mix-detail read
     -> resolve identity once within the trusted API request
     -> authorized audio read
     -> derive metadata from eligible public fields
     -> read favorite membership for this user and audio
     -> return page projection
  -> WWW renders HTML or returns transition flags
```

This is an option for a concrete page workflow, not a generic aggregation framework. Keep existing resource endpoints for their existing callers.

## Key Decisions

- Reduce required work before adding caches.
- Do not remove security checks by passing a browser-controlled principal to API services.
- Do not postpone favorite state or metadata to the client as an unapproved UX change.
- Do not call legacy MDX compilation the bottleneck: measured compile spans are approximately zero, and the current default compiler returns an empty string.
- Optimize the database query shape only after checking generated SQL and separating adapter latency from execution latency.
- Start with mix detail, not a rewrite of every WWW loader.

## Risks

- Reusing actor-visible content for public metadata can leak draft fields. Public eligibility must remain explicit.
- Parallel reads can increase database pressure and must not cause session-refresh cookies to be lost or applied incorrectly.
- Membership state must remain scoped to the authenticated user and current audio.
- A page endpoint can become an oversized aggregate if it expands beyond the specific read workflow.
- Local dev startup, remote storage, and session behavior may differ from production; compare like-for-like environments.

## Next Evidence Needed

Reload or revisit `/mixes/fer-1` while signed in. Capture its `x-request-id`; inspect the new auth, audio-query, rendering, and label spans. Then choose whether small loader/read improvements suffice or an API-owned page read is justified.
