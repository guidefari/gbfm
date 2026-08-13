# D1 drill re-run and parity re-diff, 2026-08-13

Re-runs the OPS-249 parity comparison and the two drills that
`d1-cutover-readiness.md` left open, after the fixes that landed since it was
written (`36ac95cc` favorites contention, `754779ae` MDX boot CPU,
`e2e4682b` Spotify race).

Production access was read-only throughout: the migration issues `SELECT`
only. All writes went to the `d1-staging` database.

## Tooling added

- `apps/server/scripts/remote-d1.ts` — `D1Database` over the D1 REST API.
  `migrate-pg-to-d1.ts` could previously only write to a local Miniflare
  database, so no path existed to refresh a deployed environment. Setting
  `D1_DATABASE_ID` now selects the remote target. **OPS-250's final delta
  import had no tooling before this.**
- `scripts/api-test/parity.ts` — the parity comparison, previously ad-hoc.
  Reports order-only differences separately from content differences.

`batch()` over REST is **not atomic**: D1 rejects bound parameters alongside
multi-statement SQL (error 7400), so each statement is a separate request.
Safe for this migration because every insert is `INSERT OR REPLACE`.

## Fresh import

Ran `migrate-pg-to-d1.ts` from production into
`gbfm-Database-d1-staging-hjxg2lbeiirvov2u`.

All 41 tables imported. Row counts match production on 34 tables. The other 7
hold **more** rows in D1 than production, all leftovers from earlier drills —
the import replaces and adds but never deletes.

Identity diff on the six single-key tables among them:

| table | d1-only | pg-only |
| --- | --- | --- |
| email_delivery_logs | 2 | 0 |
| music_reminder | 1 | 0 |
| navigation_sessions | 26 | 11 |
| navigation_trail_entries | 54 | 11 |
| newsletter_subscribers | 1 | 0 |
| session | 3 | 0 |

`pg_only = 0` on four tables: every production row imported. The 11 rows on
the navigation tables were created 2026-08-11, after the export read them —
anonymous browsing sessions from live traffic, not import failures.

Production content is otherwise quiet: newest post 2026-08-08, newest user
2026-07-16. The navigation tables still take live writes.

## Parity: 7 of 14 exact, 2 order-only, 5 with field differences

Identical results before and after the drills.

| endpoint | verdict |
| --- | --- |
| `/health/live`, `/health/ready` | exact |
| `/api/shows` | exact |
| `/api/content/audio/track` | exact |
| `/api/music/artists`, `/api/music/albums`, `/api/music/playlists` | exact |
| `/api/music/tracks`, `/api/profile/guidefari` | order only |
| `/api/content/posts`, `/api/content/posts/micro` | 1 field diff each |
| `/api/content/audio/mix` | 2 field diffs |
| `/api/music/labels` | 9 field diffs |
| `/api/search?q=ambient` | 21 field diffs |

Every difference is accounted for, and none is a new defect:

**`tags: [] vs null`** (posts, posts/micro, 9 of the labels rows) — the
documented, accepted history loss. `migrateArrayFanOuts` maps `row.values ?? []`,
so a Postgres `[]` and a Postgres `null` both produce zero `entity_labels`
rows and are indistinguishable afterwards. Recorded in
`d1-staging-rehearsal.md`.

**`playCount` off by one on `gb65` and `gb66`** — the only difference not
previously documented. Verified against production directly: exactly those two
rows differ, each by one, on the two most recently played mixes. Live plays
landed between the export and the diff. Not a projection bug.

**`/api/search`** — FTS5 trigram versus Postgres `ILIKE` ranking. Different
result sets, accepted in `postgres-to-d1.md`'s risk register.

**Order-only on `/api/music/tracks` and `/api/profile/guidefari`** — staging
breaks `createdAt` ties by `asc(id)`; production still runs pre-fix code that
cannot. Resolves by construction once production deploys this codebase.

## Drill 1: concurrent writes — PASS (was the blocker)

20 concurrent `POST /api/favorites` on the same row, via a throwaway staging
account.

| path | 200 | 409 | 5xx | empty-bodied non-200 |
| --- | --- | --- | --- | --- |
| audio favorite | 1 | 19 | 0 | 0 |
| show favorite (also auto-subscribes) | 1 | 19 | 0 | 0 |

Latency min 912ms, p50 1675ms, max 2285ms.

Database confirms exactly one row per user for the drilled audio. The
pre-fix run was a 30-40% failure rate of empty-bodied, uncaught 500/503s.
**`36ac95cc` holds under contention.**

## Drill 2: Time Travel restore — PASS (was a blocker)

Bookmark `00000017-0000001a-000050c6-2974c5ea0b12eadf65d4eeff4031410f`, with a
marker row inserted after it to prove the revert.

- restore API accepted in 3s
- marker gone, `/health/ready` 200, `/api/shows` 200 at **t+1s**
- all table counts intact afterwards

The previous drill's 20+ minute stabilization with intermittent edge 1102s
**does not reproduce**. Consistent with the 1102 root cause being the
module-scope MDX evaluation fixed in `754779ae`, which an earlier agent had
misattributed to Time Travel.

## Cleanup

Drill account, its sessions, favorites, show subscription and the marker row
were deleted. Staging is a clean production mirror: users 19, favorites 12,
subscriptions 3, posts 227, labels 15.

## Still open for cutover

1. **Email staging gate** — `email-staging-gate.md` is still NOT RUN, and the
   deployed `d1-staging` Worker has **no `EMAIL` binding** (verified against
   its live binding list), so it cannot exercise the email path at all. Human
   operator, attended shell.
2. **Cloudflare Rate Limiting rule** (OPS-256) — user-owned, unbuilt.
3. **Sentry transport** — `SENTRY_DSN` is bound on staging but no event
   delivery was verified here.
4. **Reminder delivery** — cron and queue consumer registered; no message
   delivery tested. Needs the email gate first.
5. **Avatar multipart upload** — still unexercised.
6. **Human cutover operations** (OPS-250) — freeze, final delta import, DNS,
   unfreeze. The delta import now has tooling; the sequence remains unrehearsed
   against the deployed stack.

## Reproducing

```sh
# fresh import (destructive to the target D1)
cd apps/server
D1_DATABASE_ID=<id> bunx sst shell --stage=prod -- bun -e '
  process.env.PG_HOST=process.env.DatabaseHost; ...; await import("./scripts/migrate-pg-to-d1.ts")'

# parity
bun run scripts/api-test/parity.ts --verbose
```

Note that `sst shell` swallows the migration's stdout; verify by querying the
target rather than by reading its output.
