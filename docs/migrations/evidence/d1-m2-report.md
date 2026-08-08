# D1 Migration M2 Report

## Scope

M2 removed the module-level Drizzle `db` singleton from `apps/vps` without changing
Postgres queries, schema definitions, SQL dialect behavior, or runtime deployment.

- 81 application and test files changed: 79 modified, one added, and one deleted.
- Added `apps/vps/src/db/layer.ts` with the `Database` Effect service and a
  `DatabaseLayer(pool)` constructor for the existing Postgres pool.
- Removed the `db` export from `apps/vps/src/db/index.ts` and deleted the
  `DatabaseService` singleton adapter.
- Added the database and Better Auth capabilities to the existing app layer graph.
- Converted services, HTTP handlers, repositories, migrations, and scripts to use
  the supplied database client.
- Added `apps/vps/src/test/database.ts`; integration tests retain their real
  Postgres fixtures while providing the database through the test layer.

`effect@4.0.0-beta.99` exposes the installed class-style API as `Context.Service`,
not `Context.Tag`, so `Database` follows the repository's existing service-tag
convention while providing the requested dependency capability.

## Refactor Notes

- Better Auth constructs its Drizzle adapter outside an Effect generator. It now has
  an `Auth` service built by `AuthLive` from `Database`; middleware, routes, and
  invitation handlers obtain that service from context.
- Plain repository helpers cannot yield Effect context. They now accept the supplied
  `DatabaseClient` explicitly, including Better Auth callbacks.
- Standalone maintenance scripts and test setup construct `DatabaseLayer(pool)` at
  their execution boundary. The Bun/ECS Postgres pool remains intact for local
  development, tests, and the current production runtime.
- `services/s3.service.ts` was not touched.

## Validation

`bun precommit` passed before each implementation commit.

Full Testcontainers suite, verbatim result:

```text
$ bun --filter @gbfm/vps test
Test Files  38 passed (38)
Tests  402 passed (402)
Start at  01:53:53
Duration  13.43s (transform 7.09s, setup 244ms, import 34.35s, tests 15.05s, environment 4ms)
[test] Stopping PostgreSQL container...
Exited with code 0
```
