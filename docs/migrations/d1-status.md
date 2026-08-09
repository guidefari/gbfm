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
| `d1-m3-schema` | 1 commit ahead of `prod`, clean | All M3 schema translation. **Ready for review.** |
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
| M3 schema and query translation | OPS-247 | **Done**, green, awaiting review | `d1-m3-schema` |
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

### M3: done and green

One commit on `d1-m3-schema`: `feat(db): translate schemas to D1 (OPS-247)`,
64 files, +7333/-1280. Verified independently, not just self-reported:

- `bun precommit` passes across all 8 packages;
- 7 D1 tests pass via the Miniflare harness, no Docker;
- zero `as any`, zero `as unknown`, zero deleted or skipped tests.

Contents:

- all 14 schema files translated to `sqlite-core`, 43 tables, with a generated
  standalone SQLite baseline in `apps/vps/drizzle-d1/` kept separate from the
  Postgres migration history;
- polymorphic `labels` / `entity_labels` replacing all nine array columns, with
  `entity_labels.position` preserving source array order;
- `db/labels.ts`: the read and write projections, including a batch
  `projectEntityLabelsForRows` that avoids N+1 on list endpoints;
- standalone trigram FTS5 tables and maintenance triggers; `search.service.ts`
  now uses `ftsMatches` with a `LIKE`/`lower()` path for short queries;
- navigation partial unique indexes preserved;
- Better Auth on the SQLite provider.

Two deliberate compromises, both documented in `evidence/d1-m3-report.md`:

- **`navigation.service.ts` keeps `.for('update')` under two `@ts-expect-error`
  comments.** SQLite has no `SELECT FOR UPDATE`. This is the single category C
  site. Suppressing the type error preserves the Postgres runtime semantics
  until M4 replaces the transaction with a Durable Object. The alternative,
  deleting `.for('update')` to satisfy the compiler, would silently break
  navigation locking, which is strictly worse.
- **Eight `scripts/*.ts` excluded from typecheck**, each listed individually with
  a reason. Seven are historical one-off maintenance scripts. The eighth,
  `scripts/seed-music-lookups.ts`, is **live tooling**: it runs as part of
  `db:migrate` in `apps/vps/package.json`. M4 must port it, not delete it. Do not
  let this exclusion quietly become permanent.

## What is next

1. **Review the M3 diff** (`git diff prod..d1-m3-schema`, one commit) and merge
   if sound. This is the current blocking step: nothing else runs until you have
   looked at it.
2. **M4: Worker runtime and Alchemy stack.** Unblocked now that the package name
   is settled. Includes the navigation Durable Object, the `apps/vps` to
   `apps/server` rename, Cron plus Queue for reminders, rate-limiter deletion,
   the SSE-to-polling change in `apps/www`, and a bundle re-measurement after the
   Cloudflare Sentry SDK is wired. Also: port `seed-music-lookups.ts` and remove
   its typecheck exclusion, and replace the two `@ts-expect-error` suppressions in
   `navigation.service.ts` with the Durable Object.
3. **M5: data migration tooling.** Blocked by OPS-252.
4. **Cutover.** Human only. See the checklist on OPS-250.

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
