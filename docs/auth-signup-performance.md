# Auth Signup Performance Findings

## Summary

Signup slow because many sequential DB round trips on high-latency DB path.

Not main causes:

- missing index in schema
- password hashing
- query planner on `user.username` / `user.id`
- app-side query span wrapper overhead

Main causes found so far:

- backend username uniqueness check before insert
- many serial Better Auth queries during signup
- welcome email side effects added visible work, now moved off critical path
- DB path has roughly 190-210ms floor per query even on warm path

## Trace Findings

### Early traces

- `api.auth.signUpEmail` around 5s
- `auth.signUp.sendVerificationEmail` around 1.5-1.8s
- rest of signup around 3s+

Conclusion:

- email side effects part of problem
- not whole problem

### After moving email to background tasks

- successful signup traces mostly around 1.2s to 2.1s
- outlier around 3.6s

Conclusion:

- moving email off critical path helped
- core auth path still slow

### Hashing trace

- `auth.signUp.hashPassword` around 97-103ms

Conclusion:

- password hashing not bottleneck

### DB query traces

Slow path trace initially showed:

- `select user by username` around 1.4s
- `select user by id` around 1.37s
- inserts around 0.2s

Warm path trace later showed:

- `select user by username` around 198ms
- `select user by email` around 199ms
- `insert user` around 199ms
- `insert account` around 203ms
- `insert email_delivery_logs` around 195ms
- `select user by id` around 214ms
- `update email_delivery_logs` around 203ms
- `insert session` around 329ms

Conclusion:

- warm path still slow
- not cold-start-only problem
- each extra DB round trip costs roughly 200ms
- total signup latency mostly sum of serial DB operations

## EXPLAIN ANALYZE Findings

Ran against `user.username = 'guidefari'`.

Actual DB state:

- `user_pkey` on `user.id`
- `user_username_unique` on `user.username`
- `user_email_unique` on `user.email`
- `user_display_username_unique` on `user.display_username`

Plan:

```sql
Seq Scan on "user"  (cost=0.00..1.07 rows=1 width=314) (actual time=0.019..0.024 rows=1.00 loops=1)
  Filter: (username = 'guidefari'::text)
  Rows Removed by Filter: 29
  Buffers: shared hit=1
Planning Time: 0.078 ms
Execution Time: 0.081 ms
```

Conclusion:

- index exists
- planner chooses seq scan because table tiny
- SQL itself effectively free in explain run
- performance problem not missing index

## Username Check Source

Current backend username precheck comes from Better Auth username plugin.

Source:

- `node_modules/.old_modules-.../better-auth/dist/plugins/username/index.mjs`
- signup hook at lines around 198-223

Behavior:

- on `/sign-up/email`
- validates username
- runs `findOne({ model: "user", where: [{ field: "username", value: username }] })`
- throws `USERNAME_IS_ALREADY_TAKEN` before insert

Conclusion:

- this query is real extra signup cost
- safe candidate to remove if DB unique constraint remains authority
- frontend already does async username availability check

## Current Code Changes

### Keep for production

- `apps/vps/src/lib/auth.ts`
  - `advanced.backgroundTasks.handler`
  - keeps verification email side effects off critical path
- welcome verification email flow itself
  - business behavior, not debug-only

### Debug-only, remove before prod

- `apps/vps/src/lib/auth-tracing.ts`
  - signup trace id async context
  - parent span map
  - tracing error helpers only needed for investigation
- `apps/vps/src/routes/user/better-auth.routes.ts`
  - custom signup request span wiring
  - trace id header injection
  - signup-specific parent span plumbing
  - keep missing-origin cookie fix if still needed for Postman support
  - remove tracing-specific parts before prod
- `apps/vps/src/db/index.ts`
  - `pool.query` instrumentation
  - `db.pg.query` spans
  - pool counters and `db.query.execution_ms`
- `apps/vps/src/lib/auth.ts`
  - `hashPassword` tracing wrapper
  - verification-email tracing spans
  - tracing-specific `runApp(...)` / `withSignupRequestParentSpan(...)`
- `apps/vps/scripts/explain-auth-user-query.ts`
  - local investigation tool
- `infra/dev.script.ts`
  - `Explain_Auth_User_Query` dev command

## Constraints

- do not change DB schema yet
- want real production-like DB performance

## Next Solution Work

### First

- keep side effects off critical path
- already done for verification email branch
- collapsed welcome email log: was insert PENDING + send + update SENT/FAILED (3 DB ops). now send + insert SENT/FAILED (1 DB op). saves 2 round trips on the background path

### Next

- reduce serial DB round trips
- remove backend username precheck on signup path
- rely on DB unique constraint for final authority
- frontend availability check remains UX layer

### Then

- combine reads where possible
- ~~inspect why Better Auth does `select user by id` after signup~~ - identified, see below
- look for config or plugin paths that force extra round trips

## Mystery `select user by id` - identified (library issue, not fixing)

Source: Better Auth `admin` plugin registers a `session.create.before` databaseHook that always calls `findUserById(session.userId)` to check the banned/banExpires fields before any session insert. This fires on every signup and every sign-in, costing one extra DB round trip (~200ms here) on the critical path even though the user was just created moments earlier with `banned: false`.

References:

- local clone: `/Users/guidefari/source/better-auth/packages/better-auth/src/plugins/admin/admin.ts:96`
- node_modules build: `node_modules/.bun/better-auth@1.4.17+.../node_modules/better-auth/dist/plugins/admin/admin.mjs:36`

Behaviour: hook is hardcoded, no opt-out flag. Runs on every `createSession` because Better Auth runs all matching hooks in order.

Why we are not fixing now:

- library-level concern, fix would require forking the admin plugin or a PR upstream
- admin plugin is otherwise wired into our roles/permissions setup (see `apps/vps/src/lib/auth-permissions.ts`)
- ~200ms is real but acceptable for current scale; not blocking

Possible future fixes if revisited:

- fork admin plugin locally and move the ban check from `session.create.before` to a session-validation middleware that runs on session use, not create
- upstream PR adding an option to skip the eager ban check
- if ever introducing a redis/secondaryStorage layer, the existing `secondaryStorage` path in `internal-adapter.createSession` already does its own `findOne user by id` so the cost would still exist there

## Expected Wins

Most likely low-risk app-side win:

- remove username precheck query: save roughly one DB round trip

Potential additional wins:

- reduce other Better Auth queries if configurable
- side effects already moved off critical path
