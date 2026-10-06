# Track C: session reads and D1 transport

## Implemented application change

`apps/server/src/lib/auth.ts` now enables `advanced.database.joins: true`. Cookie caching stays disabled. No transport, infrastructure, schema, migration or deployment settings were changed.

Installed versions inspected: Better Auth and its Drizzle adapter 1.7.5, Drizzle ORM 0.45.3, Alchemy and its Cloudflare runtime 2.0.0-beta.79, Effect 4.0.0-rc.116.

This is the supported current setting, not the older `experimental.joins` option. Better Auth's `db/internal-adapter.mjs` requests `join: { user: true }` for `findSession`. Its core `db/adapter/factory.mjs` withholds that join from the adapter unless `advanced.database.joins` is enabled and resolves related rows separately. The installed Drizzle adapter's `findOne` executes `db.query.session.findFirst({ with: { user: true } })` when joins are enabled. The existing `sessionRelations.user` and exported schema already support this query. No dependency upgrades or relation changes are needed.

The generated D1 query includes the user through SQLite `json_array` relational projection in one statement, rather than a literal SQL JOIN. The relevant optimization is one binding execution rather than two sequential executions.

## Verification

`apps/server/src/lib/auth.d1.test.ts` uses the existing disposable Miniflare D1 harness with the real forward migrations. A Drizzle logger supplied through the test Database layer records SQL strings only, never parameters. Tests exercise the production AuthLive layer, the HTTP auth handler and `auth.api.getSession`, including the page resolver's `returnHeaders: true` interface.

Observed query counts:

| Request | Executions with joins |
| --- | ---: |
| No cookie or bearer token | 0 |
| Valid cookie or bearer session | 1 |
| Next request after role update, including demotion | 1 |
| Missing token or deleted session | 1 |
| Session renewal | 2: read plus UPDATE RETURNING |

The previously observed valid-session path had two sequential reads. The new test fails if that two-read fallback returns. Renewal previously required those two reads plus an update; renewal is still authoritative and still persists its new expiry.

Covered behavior: signup, awaited password-reset delivery, current role lookup, elevated-role demotion, cookie and bearer revocation, missing and expired tokens, expired-session cleanup, user isolation with a second admin user, username/displayUsername and impersonation field projection, Date mapping, renewal persistence and returned Set-Cookie, and no needless cookie renewal for a fresh session.

Targeted commands:

- `cd apps/server && bun run test:d1 src/lib/auth.d1.test.ts`
- `cd apps/server && bun run typecheck`
- `bun ./node_modules/oxlint/dist/cli.js apps/server/src/lib/auth.ts apps/server/src/lib/auth.d1.test.ts`
- `bun ./node_modules/oxfmt/dist/cli.js apps/server/src/lib/auth.ts apps/server/src/lib/auth.d1.test.ts --check`

Global `bun precommit` is reserved for the parent after integration, avoiding concurrent formatting of other agents' files.

Final targeted auth run: three tests passed. Targeted lint and formatting check passed. Server typecheck passed before the other tracks' edits arrived; the final shared-worktree run reports in-progress errors in `show.service.ts` (`provideDb` missing, unknown result and missing `getNavigationShows`). No auth errors were reported. Those files were left to track B, and integrated typecheck must be rerun by the parent.

## Local remote transport versus production

`alchemy/storage.ts` deliberately adopts the production database name and applies `Alchemy.remote(config.isLocalDev)` during local development. It binds the real database unless the explicit disposable/local clone option is supplied. This behavior was left untouched.

Installed source establishes the local remote path:

1. `alchemy/src/Cloudflare/Workers/RuntimeBindings.ts` maps a non-local D1 id to `D1.remote`.
2. Cloudflare runtime `src/core/bindings/d1/D1.ts` wraps `cloudflare-internal:d1-api` over a remote fetcher using `{ type: "d1", raw: true }`.
3. `remote-bindings/workers/client.worker.ts` forwards fetch through HTTP with binding metadata. D1's raw path does not use the generic capnweb WebSocket RPC path.
4. `remote-bindings/workers/outbound.worker.ts` uses a local shared `RemoteBindingProxy` actor and forwards to a Cloudflare preview worker with a preview-token header.
5. `remote-bindings/workers/remote.worker.ts` forwards raw fetch to its bound D1 fetcher.

The extra workstation-to-preview-worker network leg exists only in local remote development. Production `DatabaseLayer(env.DB)` wraps the native Worker D1 binding directly. Constructing Drizzle per invocation does not establish a TCP database connection or create a traditional connection pool. Drizzle's `d1/session.js` simply prepares, binds and executes through the supplied binding. There is no app-level pool size, socket reuse or idle-timeout option on this path. Workerd owns underlying fetch transport; changing a Node HTTP agent would not tune these D1 binding calls.

## Existing reuse and retry behavior

The installed Alchemy remote-binding runtime already:

- Prefetches the preview deployment while building the local worker.
- Caches preview configuration in the shared local proxy actor.
- Reuses the preview session until 50 minutes have elapsed.
- Serializes refresh with `blockConcurrencyWhile` and rechecks the cache, preventing concurrent stale-session redeploy storms.
- Refreshes and retries once for specific HTTP 400 stale-preview signals: invalid preview configuration, error 1031 or stale BindingNotFound.
- Applies a 30-second timeout to preview control-plane operations in `RemoteWorker.ts`.

This is preview-session reuse, not query-result caching or a D1 connection pool. Recreating the application Drizzle wrapper does not recreate this preview session. No evidence establishes that these refreshes caused the previously observed 9 to 16-second spike. Additional retries were not added.

Cloudflare documents automatic retry of read-only D1 queries up to two more times for retryable errors. Thus a single logged SQL statement is an application execution count, not proof that the platform performed no internal retries. Avoid multiplying this retry budget without error evidence and an idempotency policy.

## Infrastructure candidates, not applied

1. **Production Smart Placement trial.** Installed Alchemy supports Worker `placement` and forwards it to upload/settings metadata. `alchemy/api.ts` does not specify placement. An explicitly approved `placement: { mode: "smart" }` trial could reduce repeated Worker-to-primary round trips, but cannot remove the workstation network leg in local remote development. Measure actual deployed placement, Worker region, D1 `served_by_region`/`served_by_primary`, end-to-end latency and representative traffic first. Placement only affects fetch handlers, not RPC methods or named entrypoints. It may require traffic from multiple locations and up to 15 minutes for analysis. No production placement status was queried in this track.
2. **Selective content read replication.** Installed Alchemy D1 supports `readReplication: { mode: "auto" }`. Enabling that alone does not redirect this app's existing queries: Cloudflare requires the D1 Sessions API. Do not route authentication to `first-unconstrained` or trust an old browser bookmark, as another actor's revocation/demotion may not yet be replicated. A fresh `first-primary` authoritative auth read is required if adopting sessions. Content-only replica reads need an explicit consistency design, visibility tests and authorization review. No replication or Sessions API changes were made; live replication status remains unverified.
3. **Do not change primary location as a latency toggle.** Alchemy marks `primaryLocationHint` creation-only and a change triggers database replacement. This is not an in-place optimization and is excluded by the task's database-safety constraints. No proposed migration or replacement was performed.

## Applicability and remaining measurement

The one-query auth optimization applies to both local remote and production native-binding paths. At the measured local remote baseline of about 210 ms per read and 420 ms for auth resolution, eliminating one serialized read suggests roughly one round trip of savings. That is an estimate, not a new measured route result or a production latency claim. The parent owns bounded serial/concurrent route measurements after integrating tracks A and B. No production fixtures, auth sessions, writes or probes were created by this track.

## Official references

- [Better Auth Drizzle joins](https://www.better-auth.com/docs/adapters/drizzle#joins)
- [Cloudflare Worker placement](https://developers.cloudflare.com/workers/configuration/placement/)
- [D1 read replication and consistency](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [D1 query retries](https://developers.cloudflare.com/d1/best-practices/retry-queries/)
