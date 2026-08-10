# D1 staging rehearsal (OPS-249)

Run on 2026-08-10 against the throwaway `d1-staging` stage. This is not a
cutover and does not authorize OPS-250.

## Stack

- Worker: `https://gbfm-api-d1-staging-mebtavpzy2m53eso.guideg6.workers.dev`
- D1: `gbfm-Database-d1-staging-hjxg2lbeiirvov2u`
- R2 `UserContent`: `gbfm-usercontent-d1-staging-u6g5ag5tcemymcml`
- R2 `Mixes`: `gbfm-mixes-d1-staging-2obvedzxacwky6mw`
- KV: `gbfm-Sitemap-d1-staging-el3hl3szyvpfuns7`
- Queue: `gbfm-reminders-d1-staging-rsuaoxrtzu54fiiv`

`alchemy.run.ts` only claims `api.goosebumps.fm` when `stack.stage ===
'prod'`. `d1-staging` took the `url: true` branch and the deployed Worker has
only the workers.dev URL above. No production DNS was changed.

The pre-deploy plan resolved these isolated R2 names and Cloudflare returned
404 for both: `gbfm-usercontent-d1-staging-yp4mgnoec4rgbkpc` and
`gbfm-mixes-d1-staging-t6wuofunvrt23eje`. Alchemy generated new suffixes when
it created the stack, producing the final names above. Both the planned and
created names are stage-scoped and distinct from `gbfm-user-content` and
`gbfm-mixes`.

## Deployment and migration

`bunx alchemy --help` initially failed because `@effect/platform-node` was
absent. Adding `@effect/platform-bun@4.0.0-beta.99` and
`@effect/platform-node@4.0.0-beta.99` fixed it. `bunx alchemy plan --stage
d1-staging` reported six creates. `bunx alchemy deploy --stage d1-staging
--yes` created the D1 database, both R2 buckets, KV namespace, queue, Worker,
and its workers.dev URL.

The first Worker upload failed with this deployed-runtime error:

```text
ScriptStartupError: Uncaught TypeError: The "path" argument must be of type string or an instance of URL. Received undefined
  at node-internal:internal_url:155:15 in fileURLToPath
```

The QR PDF service read local font files at module load through
`fileURLToPath(import.meta.url)`. The Worker cannot use that filesystem path.
The service now uses PDF standard fonts, and the HTTP composition uses only the
portable Effect filesystem and path layers. The next deployment succeeded.

Alchemy applied `0000_public_thunderbolt.sql` and `0001_search_fts.sql` from
`apps/server/drizzle-d1`. The deployed D1 state records both migration hashes;
a read-only D1 query confirmed the application tables, FTS tables, and
`d1_migrations` table exist.

A fresh read-only production snapshot was migrated into a temporary local D1,
then imported into staging as an ordered data-only SQL file. The first import
failed with `FOREIGN KEY constraint failed` because SQLite `.dump` sorted
foreign-key tables alphabetically. Re-emitting the same data in the migrator's
dependency order succeeded:

```text
Processed 2737 queries.
Executed 2737 queries in 260.00ms (3346 rows read, 13389 rows written)
Database size (MB): 3.43
```

No dump, SQL data file, credential, or user row was added to the repository.
The local snapshot verification then passed all 41 table counts and checksums,
seven normalized-label fan-outs, 17 relationship checks, `pragma
foreign_key_check`, and six sharp-type checks.

## Checks

| Check | Actual result |
| --- | --- |
| Worker boot | PASS. The first request returned 200 after workers.dev propagation. |
| `GET /health/live` | `HTTP/2 200`, `{"ok":true}` |
| `GET /health/ready` | `HTTP/2 200`, `{"dbConnected":true}` |
| Public D1 read | `GET /api/shows?limit=2&offset=0` returned `HTTP 200` after the production snapshot import. |
| D1 bind | Worker configuration contains `DB` bound to `0ffe7846-804f-4c01-ba65-051415901e42`. |
| Durable Object | PASS. One anonymous `Open` returned trail `{ "index": 0, "length": 1 }`. Two concurrent same-cookie `Forward` requests both returned 200 with trail positions `{ "index": 1, "length": 2 }` and `{ "index": 2, "length": 3 }`. The final session was readable. |
| Cron | PASS. The deployed configuration has cron `* * * * *`; scheduled logs recorded sitemap regeneration after the snapshot load. |
| Queue consumer | PASS after adding `ReminderConsumer`. Cloudflare reports one Worker consumer, script `gbfm-api-d1-staging-mebtavpzy2m53eso`, batch size 10, max retries 3, and max wait 5000 ms. No reminder delivery was exercised. |
| Sentry Cloudflare wrapper | PASS for boot safety. The real Worker imported and wrapped the handler with `@sentry/cloudflare` and served health and D1 requests without a Node-only import crash. No `SENTRY_DSN` binding exists on this throwaway stack, so outbound event transport was not exercised. |
| Worker bundle | The deployed multipart download contained 58 JavaScript modules, 7,069,675 JavaScript bytes, and 2,004,627 gzipped JavaScript bytes, or 1.91 MiB. This is 0.65 MiB below the prior 2.56 MiB estimate in `d1-bundle-size.md`. Source maps are excluded from that module measurement. |

The workers.dev URL initially returned Cloudflare error 1042 during propagation. It returned the 200 results above one minute later.

## Broad public API comparison

A read-only comparison used the same production snapshot and compared canonical
JSON bodies, preserving array order, against `https://vps.goosebumps.fm`.
Fourteen public GET endpoints all returned the same HTTP status, 200.

Exact canonical-body matches: `/health/live`, `/health/ready`,
`/api/content/posts/micro?limit=2&offset=0`,
`/api/content/audio/mix?limit=2&offset=0`,
`/api/content/audio/track?limit=2&offset=0`, and `/api/music/playlists`.

The remaining eight endpoints returned 200 on both stacks but did not have
matching bodies: `/api/shows?limit=2&offset=0`, `/api/content/posts?limit=2&offset=0`,
`/api/music/artists`, `/api/music/albums`, `/api/music/tracks`,
`/api/music/labels`, `/api/search?q=ambient&limit=2`, and
`/api/profile/guidefari`.

The comparison records only endpoint paths, statuses, and hashes. It records
no response bodies. Several mismatches are visible null-versus-empty-array
normalization differences, including tags and genres. The remaining body
mismatches need endpoint-level parity review before cutover.

During this run `/api/music/artists` first returned 500 because its normalized
label projection bound more than D1's request parameter budget. Batching the
projection at 99 entity IDs fixed it. The deployed artists and tracks list
endpoints then both returned 200.

## Open gates

- Better Auth logs warn that no base URL is configured in this stage. Session
  continuity and authenticated API parity are unverified.
- The public comparison has eight body mismatches. They block a claim of broad
  API parity.
- The queue consumer is registered but no delivery was tested. The cron and
  queue paths need safe, non-production email configuration before an end to
  end reminder test.
- The portable filesystem layer does not support the existing avatar multipart
  upload path. That path was not exercised.
- No deployed write-contention test, D1 Time Travel restore drill, session
  handoff, rate-limiting check, final-delta migration, write freeze, or DNS
  change was attempted.

## Teardown

Leave this stage running for inspection. Destroy it only with:

```sh
bunx alchemy destroy --stage d1-staging --yes
```
