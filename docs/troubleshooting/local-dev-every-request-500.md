# Every local request 500s

Two independent bugs produced the same symptom: every vps response was an
empty `500`, including public routes and `/health/live`. The whole
`routes.blackbox.test.ts` suite (138 tests) failed with it too, which made it
look like a broken test setup rather than real bugs.

## Bug 1: RequestLoggerLive parsed a relative URL

`apps/vps/src/http/global-middleware.ts` did:

```ts
const path = new URL(request.url).pathname
```

`new URL()` with no base throws `TypeError: Invalid URL` for a relative
request target like `/health/live`. HTTP requests carry a relative target in
the request line, so `request.url` is often just the path.

This middleware is registered `{ global: true }`, so it wraps every route and
the throw happened before any handler ran. It also threw before its own
logging could report anything, which is why the 500s had empty bodies and left
nothing in the logs. `RateLimiterLive` a few lines above already had the
correct form.

**Fix:** pass a base to both call sites. Only `.pathname` is read, so the host
is never used.

**Regression test:** `apps/vps/src/http/global-middleware.test.ts` mounts a
trivial route through `RequestLoggerLive` and asserts 200 for both an absolute
request URL and a relative request target. Reverting the fix fails both.

## Bug 2: local postgres was handed an SSL config it cannot honour

With bug 1 fixed, `/health/live` recovered but every DB-backed route still
500'd on `Failed query: ...`. The real driver error was:

```
The server does not support SSL connections
```

`apps/vps/src/db/index.ts` picked SSL purely by stage, and stage `dev` yields
`{ rejectUnauthorized: false }`. That still asks pg to negotiate SSL, and the
docker-compose postgres is built without SSL support, so the handshake fails
outright instead of falling back to plaintext. Note `drizzle.config.ts`
already hardcoded `ssl: false`, so the two paths disagreed.

**Fix:** disable SSL when the database host is local (`localhost`,
`127.0.0.1`, `::1`). Remote dev/prod databases keep their existing SSL config.

## Not a bug, but worth knowing

The local `postgres` database has an empty `drizzle.__drizzle_migrations`
ledger while 50 migration files exist on disk, so its schema is missing newer
columns (for example the post threading columns `parent_post_id`,
`root_post_id`, `depth`, `quoted_post_id`). Queries selecting those fail with
postgres `42703` (undefined column).

`drizzle-kit migrate` cannot bootstrap it from empty either: `0001` fails with
`index "mixes_slug_idx" does not exist` because this migration history was
baselined after an early `drizzle-kit push`.

Verification for this fix was done against a throwaway `gbfm_verify` database
built with `drizzle-kit push`. The developer's own database was left untouched.
