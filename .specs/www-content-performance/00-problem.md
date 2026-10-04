# WWW content performance

## Summary

Reduce the time to display content on direct loads and in-app transitions. Start with the mix detail path, measure each dependency, remove repeated reads, and overlap independent work without changing content visibility or initial page behavior. This is a design draft, not authorization to change production behavior.

## Current State

- Direct page loads fetch data and render HTML through Foldkit 0.163.0. In-app navigation fetches the same route with `__data=1`, returning JSON for client rendering.
- Mix loading currently waits for identity, content, favorite state, and metadata in sequence. See `apps/www/src/server/page-data/index.ts` and `apps/www/src/server/page-response.ts`.
- WWW checks the session through `/auth/get-session`; the mix API independently resolves its optional actor before calling `audio.getBySlug`. See `apps/server/src/http/audio.handlers.ts` and `apps/server/src/http/handler-utils.ts`.
- Favorite state is determined by paging through `/api/favorites` until the audio is found or the list is exhausted. See `apps/www/src/server/page-data/identity.ts`.
- The captured trace includes a second `audio.getBySlug` under site metadata.
- In-app revisits can display cached page data while revalidating. HTTP page responses remain `private, no-store`.

## Problem

The local trace `cb636e26a94e65f1354270ae99afe80b` covers approximately 7.85 seconds. Its WWW span lasts approximately 7.73 seconds. API calls on its serial path last approximately:

| Operation | Duration |
| --- | ---: |
| Session | 417 ms |
| Mix API | 4,934 ms |
| Favorites API | 1,729 ms |
| Metadata API | 590 ms |

Within the mix API, `audio.getBySlug` takes 3,508 ms. Existing spans do not isolate the audio database query, rich-content rendering, or label projection. The time before this service span also needs measurement; optional session resolution is a candidate, not a proven cause. The `mdx.compile` span is approximately zero milliseconds, so legacy compilation is not the measured bottleneck.

Fresh unauthenticated curl requests to the data route took 0.84 to 2.16 seconds; these are not equivalent to the authenticated screenshot request. The exact mix slug is not recorded on the normalized WWW route span, so the slow trace is a strong match rather than definitive browser-request identification. Preserve request-ID correlation for future reproductions.

## Users / Callers

Anonymous readers, signed-in listeners, creators opening their own drafts, and administrators. Both direct document requests and client transitions use this loading path.

## Goals

- Establish comparable anonymous and authenticated baselines, including repeated requests and first requests after restart.
- Attribute slow requests to session resolution, database reads, rich-content work, dependency latency, or development tooling.
- Avoid loading a full favorites collection to answer one membership question.
- Avoid fetching and rendering the same audio twice for content and metadata where their visibility rules allow reuse.
- Remove unnecessary serial waits while preserving cancellation and response cookies.
- Demonstrate gains with before/after traces and browser navigation measurements. Set numerical targets after collecting a representative baseline; do not promise an unmeasured p95.

## Non-Goals

- Replacing Foldkit or changing SSR to a client-only app.
- Broad service refactoring, new caching infrastructure, or database schema changes.
- Assuming local dev timing represents production performance.
- Making favorite state or metadata load later without a separate behavior decision.

## Constraints

- Planning only. Implementation needs approval where production behavior may be affected.
- Use current Effect and Foldkit versions and existing trace propagation.
- No secrets, cookies, authorization values, or content bodies in telemetry.
- Validate eventual code changes with `bun precommit` and tests through real service/HTTP seams.

## Invariants

- Draft visibility and actor authorization remain enforced by the API, not trusted from browser-supplied identity.
- Anonymous requests never receive personalized data; no shared caching of signed-in responses.
- Existing metadata, canonical URLs, status codes, session-cookie refresh, and unavailable-state behavior remain correct.
- Favorite state remains scoped to the authenticated user.
- Direct-load content and hydrated content remain consistent.

## Open Questions

- Which part of the 3.51-second audio lookup is slow, and why does its latency vary?
- How much time does optional actor resolution consume before the audio service starts?
- Are repeated reads against local storage or a remote dependency in the current dev setup?
- Can metadata reuse the loaded public projection without exposing creator/admin-only drafts or changing its public semantics?
- Is a target-specific favorite lookup already available, or does the API need a small additive endpoint?
- What are comparable authenticated and anonymous distributions in local development and production?
