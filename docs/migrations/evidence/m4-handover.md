# M4 handover: two half-finished slices

Written 2026-08-10 after both implementer agents terminated mid-edit on an API
spend limit. Nothing here is a code failure. Both slices are partly built and
uncommitted in the working tree.

**Current state: 30 typecheck errors, tree dirty, nothing committed since
`ed0eceae`.**

Do not `git stash` this tree. Two agents' edits are interleaved and a stash has
already caused one near-miss earlier in this migration.

## Error distribution

| File | Errors | Owner |
| --- | ---: | --- |
| `src/services/navigation.service.test.ts` | 12 | Durable Object slice |
| `src/durable-objects/navigation-lock.do.ts` | 8 | Durable Object slice |
| `src/worker.ts` | 4 | both (DO binding + Sentry wrap) |
| `src/http/routes.ts` | 2 | Sentry slice |
| `src/http/health.handlers.failure.test.ts` | 2 | Sentry slice |
| `src/test/http-handler.ts` | 1 | DO slice |
| `src/runtime/index.ts` | 1 | Sentry slice |

## Slice A: navigation Durable Object (OPS-248)

Replaces the `db.transaction()` + `SELECT FOR UPDATE` in
`navigation.service.ts`, which real D1 rejects outright. This is the single
category C site from the M1 audit and the last blocker on 11 failing tests.

### What exists

- `src/durable-objects/navigation-lock.do.ts` (172 lines): the DO itself,
  SQLite-backed via `ctx.storage.sql`, with an `_identity` table.
- `src/services/navigation-lock.ts` (111 lines): the domain-named capability.
  This part is well shaped and worth keeping:
  - `NavigationLock` service tag, so `DurableObjectNamespace` never reaches a
    service signature;
  - `canonicalNavigationLockName(identity)` for instance-name canonicalization,
    rather than inline string building at call sites;
  - `LockRequest` / `LockDecision` DTOs, where `LockDecision` is
    `Duplicate | Retry | Proceed` and carries the allocated trail `position`;
  - `NavigationLockLocalLayer`, an in-process implementation for tests.

The design decision was made: **the DO returns a decision plus the allocated
position, and the caller writes to D1.** The DO owns only the serialized
decision, not the writes.

### What is broken

1. `Cannot find module 'cloudflare:workers'` and 7 × `Property 'ctx' does not
   exist`. The DO class needs the Workers types wired into `apps/vps/tsconfig.json`
   (`@cloudflare/workers-types`, or `types: ["@cloudflare/workers-types"]`).
   The `ctx` errors are all downstream of the failed `DurableObject` import.
2. `navigation.service.test.ts` (12 errors) was mid-rewrite onto the new
   capability and is incomplete.
3. `worker.ts` needs the `NAVIGATION_LOCK` namespace added to `ApiEnv`, and
   `alchemy.run.ts` needs the DO declared in the stack with a migration tag.
   Neither was done.

### Definition of done

- Both `@ts-expect-error SQLite has no SELECT FOR UPDATE` comments and both
  `.for('update')` calls are gone from `navigation.service.ts`.
- Unit suite: 409 passed, 0 failed, 0 skipped.
- A focused test proves two concurrent same-identity requests serialize, and that
  they cannot both allocate the same trail position or both pass the cursor check.

## Slice B: Sentry Cloudflare SDK swap (OPS-248)

The blocker on whether the Worker boots at all. `worker.ts` wires the full
`AppLayer`, which pulls `SentryServiceLayer` to `@sentry/bun` to `@sentry/node`'s
Node-only integrations, which cannot run on workerd.

### What exists

- `@sentry/cloudflare@10.52.0` added to `apps/vps/package.json`, matching the
  installed `@sentry/bun` version. **Note: `bun install` has not been run, so it
  is in the manifest but not in `node_modules`.** Install before doing anything
  else, or every import will look broken for the wrong reason.
- `src/runtime/sentry-bun.ts` (20 lines) and `src/runtime/sentry-worker.ts`
  (43 lines): the platform split, keeping initialization at the composition seam
  rather than scattered through services.
- Edits in progress to `sentry.service.ts`, `sentry-client.service.ts`,
  `lib/sentry.ts`, `runtime/index.ts`, `http/routes.ts`.

### What is broken

5 errors across `worker.ts`, `routes.ts`, `runtime/index.ts`, and
`health.handlers.failure.test.ts`. The swap is partially threaded through.

### Critical unfinished work

`@sentry/cloudflare` initializes by **wrapping the Worker export** (`withSentry`)
rather than calling `init()` at module scope. `worker.ts` still needs that wrap.

Node-only OpenTelemetry packages (`@opentelemetry/sdk-trace-node`,
`context-async-hooks`) cannot ship to workerd. Determine what is reachable from
the Worker entry and remove or replace it. Do not silently delete observability;
record what was preserved and what was dropped.

**The Bun/ECS runtime still serves production until cutover and must not break.**
Bun and Worker needing different initialization is expected and correct.

### Verification is the deliverable, not the swap

- Build for the workerd target and confirm no Node-only import is reachable. The
  bundle command is in `d1-bundle-size.md`.
- Re-measure gzipped size and update `d1-bundle-size.md`. The existing 2.56 MiB
  figure (against a 3 MiB limit) **explicitly excluded** the Sentry replacement.
  This measurement closes that gap and is the number that matters.
- Local `wrangler dev` / `alchemy dev` (miniflare) is permitted to prove boot.
  `alchemy deploy`, `alchemy destroy`, and `wrangler deploy` are forbidden:
  production is live and serving customers.
- State plainly what could not be verified. Do not claim boot that was not
  observed.

## Standing constraints

- `bun precommit` must pass before every commit. Never `--no-verify`.
- D1 suite stays green: `cd apps/vps && bunx vitest run --config vitest.d1.config.ts` (7 tests).
- No `as any`, no `as unknown`, no type assertions to force compilation.
- No deleting tests, no `.skip`, no weakened assertions.
- No code comments unless genuinely non-obvious. No em dashes.
- Atomic commits, conventional messages referencing the Linear issue. No
  co-author trailers, no AI attribution.
- `git add` only your own files. Never `git add -A`.
- Do not touch `s3.service.ts`, `infra/bucket.ts`, or any CDN/R2 router: another
  workstream owns those.

## Out of scope for both slices

The `apps/vps` to `apps/server` rename, the rate-limiter deletion, and the
Bluesky SSE to polling change in `apps/www`. Those are separate M4 slices and the
rename in particular is a whole-repo mechanical change that must not run
concurrently with anything else.
