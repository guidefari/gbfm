# ADR-0006: Cache completed public editorial lists

## Status

Proposed for review. Implemented on the performance branch, not deployed.

## Date

2026-10-27

## Context

Three sequential public editorial-list requests returned identical 187,485-byte
responses with 7.141s, 9.042s, and 7.142s time to first byte. Each response contains
20 fully rendered posts. The Worker creates and disposes its Effect service graph
per request, so render and provider caches do not survive into the next request.

The endpoint already declares `public, max-age=60, stale-while-revalidate=300`.
Sharing the entire handler would also share request-scoped bindings, tracing, and
delivery lifetimes. Caching outside the router would skip application telemetry.

## Decision

Cache only the completed, schema-encoded JSON for the public editorial list using
Cloudflare's existing Cache API. Keep the cache read inside the editorial handler,
under the existing CORS, request logger, telemetry, and error middleware.

- The key includes request origin, application release, limit, offset, and tag.
- Cookie and Authorization requests bypass both reads and writes. Explicit
  `no-cache`, `no-store`, `max-age=0`, and Pragma revalidation bypass the cache.
- Store only successful list values, never response headers, request IDs, errors,
  sessions, Effect runtimes, or pending lookups.
- Entries expire after 60 seconds. Carry their age into the HTTP `Age` header so
  a hit does not restart browser freshness. Reject missing or invalid timestamps.
- Decode stored JSON with the public response schema before using it. Invalid
  data, read failures, and write failures fall back to normal rendering.
- Local development and scheduled jobs have no active platform cache adapter.
  No schema, binding, infrastructure resource, or dependency is added.

## Consequences

Warm reads can skip list queries and full rich-content enrichment while retaining
the same body, pagination, and per-request telemetry. Cache entries are local to
a Cloudflare data center and may be evicted. Cold reads remain expensive.

Publication or catalog edits may take up to the remaining cache lifetime to
appear to anonymous readers. This first slice does not provide eager invalidation
or stale-while-revalidate inside the Worker. Concurrent misses may render twice;
there is no cross-request pending-I/O sharing.

## Alternatives and revisit conditions

Do not move the whole request runtime into module scope. Do not change the list
response to summaries without a separate API/consumer decision. A per-document
cache needs catalog-aware invalidation and is outside this first bounded slice.

Revisit cold rendering, query batching, and provider work under
[issue #407](https://github.com/planetaryescape/gbfm/issues/407). Assess real
hit rates and cold/warm timings after an approved rollout before extending this
cache to other endpoints.

## Test evidence

- The initial real-handler regression failed with two provider requests where
  one was expected across separately disposed handlers.
- The integration fixture exercises the real HTTP route and migrated local D1,
  with a recording provider supplied through the production fetch capability.
- Service tests cover query/release isolation, failure fallback, timestamp
  validation, age, and the 60-second expiry boundary using TestClock.
- A separate Miniflare test exercises the adapter with the actual Cache API
  across independent Worker invocations.

Final execution results and review links are recorded in issue #407 and the PR.
