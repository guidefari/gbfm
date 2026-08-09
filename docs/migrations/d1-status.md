# D1 migration: where we are

Last updated: 2026-08-09, end of the first unattended agent run.

Read this first, then `postgres-to-d1.md` for the design and
`evidence/` for the measurements behind it.

## One-paragraph summary

M1 (audit) and M2 (decouple the database handle) are **done and on `prod`**. M3
(schema translation to SQLite) is **substantially built but not green**, parked on
branch `d1-m3-schema` with an agent currently finishing it. M4 (Worker runtime)
**halted before starting** on a spec error, now fixed. M5 and the cutover have not
begun. Nothing has been deployed, no production data has been touched, and the
running ECS/PlanetScale stack is untouched and serving.

## Branches: what is where

**Nothing is pushed.** Local `prod` is **22 commits ahead of `origin/prod`**. That
includes both this D1 work and the concurrent S3-to-R2 work. Everything below
lives only on this machine until someone pushes.

| Branch | State | Contains |
| --- | --- | --- |
| `prod` (local) | 22 ahead of `origin/prod` | M1 + M2 D1 work, the spec and evidence docs, **and the R2 agent's commits** |
| `d1-m3-schema` | branched off `prod`, 0 commits, 49 files dirty | All M3 schema translation. Agent working here now. |
| `origin/prod` | 12 hours old | Last pushed state. Predates all D1 work. |
| `dev` | 13 hours old | `fix(ci): stop building retired backup image` |

Both agents committed to the same local `prod`, because that is what was
authorised. Their commits are interleaved rather than separated:

- D1 commits reference OPS-245 to OPS-248.
- R2 commits are `feat(storage): deploy R2 CDN router`, `feat(migration): verify
  R2 object parity`, `docs(migration): record Mixes copy parity`, and similar.

Untangling them later means cherry-picking by message, so if the two workstreams
need to ship separately, decide that before pushing.

### Other active worktrees, untouched by this work

`gbfm-effect-v4-beta`, `gbfm-remove-react-icons`, `gbfm-spans`, `gbfm-tweet-fix`,
`gbfm-worktrees/fix-www-spotify-pkce`, and two under `.claude/worktrees/`. None
were modified. Note that `.claude/worktrees/` copies of the schema files are what
produced the bogus 41-transaction-site count, so exclude them from any repo-wide
grep.

## Milestone status

| Milestone | Linear | State | Where |
| --- | --- | --- | --- |
| M1 audit and fixtures | OPS-245 | **Done** | `prod` |
| M2 decouple `db` from module scope | OPS-246 | **Done** | `prod` |
| M3 schema and query translation | OPS-247 | **In progress**, not green | `d1-m3-schema` |
| M4 Worker runtime and Alchemy stack | OPS-248 | Not started (halted, unblocked) | - |
| M5 data migration tooling | OPS-249 | Not started | - |
| Cutover | OPS-250 | **Human only**, not started | - |
| M6 teardown | - | Not started | - |

Parent: OPS-244. Related: OPS-251 (search debounce), OPS-252 (migration chain
cannot bootstrap).

## What is done

### M1: the gate passed

- **Bundle fits.** The ported graph is 2.56 MiB gzipped with MDX precompiled,
  2.75 MiB with MDX retained, against a 3 MiB limit. The first measurement said
  3.91 MiB because it measured today's Bun graph including `@sentry/bun`, `pg`,
  `@effect/platform-bun`, `@aws-sdk/*` and the QR/PDF stack, all of which the
  migration deletes. `evidence/d1-bundle-size.md`.
- **24 transaction sites, not 41.** The spec's 41 came from a grep that swept in
  worktree copies. Every site is classified with a per-site guard design:
  18 batchable, 5 read-then-write, 1 genuinely serialized. No site is UNCERTAIN.
  `evidence/d1-transaction-classification.md`.
- **Search and ordering fixtures captured** from real Postgres behaviour, so the
  FTS5 rewrite has a pass/fail criterion rather than a memory of how search felt.

### M2: the load-bearing refactor

`apps/vps/src/db/index.ts` no longer exports a module-scope `db`. Every service
receives a `Database` service through the Effect layer graph. This was the actual
blocker for Workers, which have no database handle at module scope.

Shipped on Postgres with no behaviour change. 38 test files, 402 tests passing.

### M3: built, not finished

On `d1-m3-schema`, uncommitted (49 files) because `bun precommit` is red and the
agent rules correctly forbid committing red.

Done:

- all 14 schema files translated from `pg-core` to `sqlite-core`, 43 tables;
- polymorphic `labels` / `entity_labels` tables replacing all nine array columns;
- **`entity_labels.position`**, added by the agent and not in the spec, so tag
  order survives the array-to-rows move;
- standalone trigram FTS5 tables with maintenance triggers for audio, posts, shows;
- navigation partial unique indexes preserved;
- Better Auth switched to the SQLite provider;
- Miniflare D1 test harness, no Docker required, 5 tests passing;
- batch label deletion wired into six delete paths.

Not done, and the reason it is not green:

- **tag/genre read and write projections.** The physical array columns are gone
  but services and HTTP handlers still read them as arrays. This is the real
  remaining work and what the running agent is doing.
- 41 typecheck errors across 18 files, most of them the Postgres runtime
  (`scripts/`, `migrate.ts`, `runtime/services.ts`, `test/database.ts`) that M4
  replaces.
- `navigation.service.ts` uses `.for('update')`, which SQLite does not have. It
  is the single category C site and needs the M4 Durable Object. It must not be
  converted to a non-atomic shim.

## What is next

1. **Finish M3 to green.** Agent running now on `d1-m3-schema`. Definition of done
   is `bun precommit` passing plus the 5 D1 tests still passing, with everything
   deferred to M4 recorded explicitly.
2. **Review the M3 diff** (`git diff prod..d1-m3-schema`) and merge if sound.
3. **M4: Worker runtime and Alchemy stack.** Unblocked now that the package name
   is settled. Includes the navigation Durable Object, the `apps/vps` to
   `apps/server` rename, Cron plus Queue for reminders, rate-limiter deletion,
   the SSE-to-polling change in `apps/www`, and a bundle re-measurement after the
   Cloudflare Sentry SDK is wired.
4. **M5: data migration tooling.** Blocked by OPS-252.
5. **Cutover.** Human only. See the checklist on OPS-250.

## Open decisions and outstanding facts

Resolved during this run, recorded so they are not reopened: no Container, no
Hyperdrive, Drizzle over `@effect/sql-d1`, `artistNames` stays denormalized JSON,
FTS5 uses the trigram tokenizer, package becomes `@gbfm/server`. Reasoning for
the two data-shape decisions is in `evidence/d1-decisions-explained.md`.

Still open:

- **Production database size and peak write rate.** No agent had or sought
  production access. This needs a human before cutover: D1 caps at 10 GB per
  database and serializes writes.
- **OPS-252: the Drizzle chain cannot bootstrap a fresh database.** No
  `0000_*.sql`, and `0013` drops constraints a `CASCADE` already removed.
  Invisible today because the database was built with `drizzle-kit push`. M5
  needs a clean bootstrap to create D1 reproducibly.
- **Does anything consume the `x-ratelimit-*` headers** that M4 removes? Grep
  `apps/www` and mobile.

## Things worth knowing before continuing

**The spec had three errors that agents caught, not me.** The transaction count
(41 vs 24), the tag design (named three join tables, missed `releases.tags` and
all four `genres` columns), and the package rename (`@gbfm/api` already exists and
`apps/vps` depends on it). Each was a fact available in the repo before the spec
was written. Treat the remaining unverified parts of `postgres-to-d1.md` with
that in mind, particularly anything M4 and M5 depend on.

**Exit code is not a completion signal.** M3 exited 0 having committed nothing,
and the chain runner read that as success and started M4 on a dirty tree. If the
chain is used again, gate progression on a green `bun precommit` and a non-empty
commit, not on the process exit code.

**One silent hang.** An M3 run consumed 1m44s of CPU across 98 minutes and had to
be killed. The cause was never established; the restart worked. A hang trips
neither the exit-code check nor the `HALT-CHAIN` sentinel, so unattended runs can
stall indefinitely without signalling.

**The `HALT-CHAIN` sentinel works.** Agents used it twice for genuine design gaps
and worked around everything they could handle themselves. The first halt was a
false positive from my own grep matching the word "stops" in prose.

## Safety position

- `prod` is clean; all M3 work is isolated on `d1-m3-schema`.
- No deployment has run. No DNS has changed. No production database was read or
  written by any agent.
- The ECS and PlanetScale stack is untouched and remains the rollback target.
- The S3-to-R2 agent's files were never modified by this work.
