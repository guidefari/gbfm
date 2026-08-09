# Migration Blockers

## 2026-08-09: Bundle gate interpretation changed concurrently

Commit `6c8dc959` changed `d1-bundle-size.md` after the current-Bun graph
measurement to define the gate as the future ported graph. The two measurements
answer different questions:

- Current HTTP graph: 3,907,876 gzipped bytes, which does not fit.
- Ported graph after externally excluding planned M3/M4 removals: 2,684,671
  gzipped bytes with MDX precompiled, which fits.

The later commit's ported-graph conclusion is retained as the bundle gate
verdict. It excludes the replacement Cloudflare Sentry SDK, so M4 must bundle
the actual Worker entry after that SDK is wired. The 256 KiB MDX-retained margin
is not sufficient evidence that the final production Worker will fit.

## 2026-08-09: Migration chain lacks its initial SQL migration

Applying `apps/vps/drizzle/*.sql` to an empty local PostgreSQL 17 database
fails in `0001_absent_vulcan.sql` because it drops `mixes_slug_idx` and
`posts_slug_idx`, but the migration that creates `mixes` and `posts` is absent.
`drizzle/meta/0000_snapshot.json` is tracked and records that missing baseline.

The local fixture uses a generated, throwaway bootstrap from that tracked
snapshot, then applies every tracked SQL migration. This is sufficient for the
M1 behavioral fixture but is not a clean migration bootstrap. M3/M5 need a
durable initial migration or a documented baseline procedure before a fresh D1
environment can be created reproducibly.

The reconstructed baseline exposed a second clean-bootstrap defect:
`0013_curvy_adam_warlock.sql` drops `users` with `CASCADE`, which already drops
the two referenced foreign keys, then attempts to drop those same constraints.
Postgres stops at the first missing constraint. The M1 fixture omits only those
two redundant `DROP CONSTRAINT` statements and applies all remaining tracked
SQL. This exception must be removed by repairing the migration history, not
carried into the D1 migration toolchain.

## 2026-08-09: Tag and genre normalization design is incomplete

The M3 instruction requires all seven source `varchar[]` declarations to be
normalized, except `artistNames`, and names only `tags`, `audio_tags`,
`post_tags`, and `show_tags` as the replacement design. Those join tables
cannot represent `music_artists.genres`, `music_albums.genres`,
`music_labels.tags`, or `music_labels.genres`; `releases.tags` is also inherited
from the shared content fields but has no named join table. The current API
schemas expose these fields as arrays.

M3 needs an approved table and API projection design for genres and the label
and release tag surfaces before their array columns can be removed safely.

HALT-CHAIN: M3 cannot complete schema translation until the normalization model
for genres and label/release tags is approved.
