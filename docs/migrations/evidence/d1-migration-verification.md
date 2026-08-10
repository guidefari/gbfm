# D1 migration verification (OPS-249)

## Methodology

**Data source: a synthetic local Postgres clone, not production data.** This
environment has no production database credentials (no `.env`, no configured
`sst`/`alchemy` secrets access), so the fallback in the OPS-249 task
description was used: a fresh local Postgres was bootstrapped from
`apps/server/drizzle/` (52 migrations, `drizzle-kit migrate` against an empty
`postgres:16-alpine` container), which also re-confirms OPS-252's fix — the
chain bootstraps cleanly from empty. It produced 41 tables, matching the spec.

That database was then seeded (`/tmp/gbfm-migration/seed.sql`, not committed —
see "Files" below) with hand-built rows chosen specifically to exercise every
sharp type named in the migration spec, not to resemble realistic production
volume:

- Fixed, known UUIDs on primary keys so identity could be checked by eye, not
  just by an automated diff.
- Timestamps with explicit sub-second precision (`...T00:00:00.123Z`,
  `...T12:34:56.789Z`) to catch truncation to whole seconds.
- Booleans in both states.
- A `CiphertextEnvelope` JSON payload on
  `external_account_sessions.app_password` / `.session` with base64-looking
  `iv`/`authTag`/`payload` fields and special characters, to catch any
  re-serialization that doesn't round-trip byte-for-byte.
- All nine array columns populated with duplicate entries, unicode, an empty
  array, and a `NULL` array, across all eight tables named in the spec
  (`audio`, `shows`, `releases`, `posts` tags; `music_artists`,
  `music_albums` genres; `music_labels` tags AND genres).
- `music_albums.artistNames` / `music_tracks.artistNames` populated in a
  deliberately different order than the corresponding `music_album_artists` /
  `music_track_artists` join rows, to prove the migration does not derive
  `artistNames` from the join table (per spec, it must not).

This proves the transform logic is correct for every sharp case it was
designed to exercise, and proves the schema/dependency-order machinery (all
41 tables, all foreign keys, both migration files) works end-to-end. It does
**not** prove behavior at production row counts, does not prove production's
actual data doesn't contain a shape this seed didn't anticipate (a malformed
timestamp, an unexpectedly large jsonb blob, an array with an empty-string
element, etc.), and does not exercise D1's 10 GB size limit or write
serialization under load. See `d1-cutover-readiness.md` for what remains
unverified.

## How to reproduce

```bash
# 1. Bootstrap a throwaway Postgres from the migration chain
docker run -d --name gbfm-pg-src -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=gbfm_migration_src -p 55432:5432 postgres:16-alpine

# 2. Point drizzle-kit at it (out-of-tree config; not committed) and migrate
bunx drizzle-kit migrate --config /path/to/drizzle.config.migration-src.ts

# 3. Seed synthetic data exercising every sharp type (see seed.sql, not committed)
psql -h localhost -p 55432 -U postgres -d gbfm_migration_src -f seed.sql

# 4. Run the migration
cd apps/server
PG_HOST=localhost PG_PORT=55432 PG_USER=postgres PG_PASSWORD=postgres \
  PG_DATABASE=gbfm_migration_src D1_PERSIST_PATH=/tmp/d1-target \
  bun run scripts/migrate-pg-to-d1.ts

# 5. Verify
PG_HOST=localhost PG_PORT=55432 PG_USER=postgres PG_PASSWORD=postgres \
  PG_DATABASE=gbfm_migration_src D1_PERSIST_PATH=/tmp/d1-target \
  bun run scripts/verify-pg-to-d1.ts --out docs/migrations/evidence/d1-migration-verification.md
```

Re-running step 4 against the same `D1_PERSIST_PATH` is idempotent: it was
run twice back to back during this work, the second run inserted zero new
`labels` rows (all reused by `(kind, name)`) and re-created the same
`entity_labels` rows, and verification passed identically both times. A
targeted drift test (mutating one Postgres row after migrating, then
re-running verification without re-running the migration) was also performed
to confirm the checksum check actually catches a mismatch rather than
passing trivially — it failed with a non-zero exit code as expected, and
passed again after a re-run of the migration script self-healed the target.

## Result of the run below

Generated 2026-08-10T14:10:33.800Z.

**Data source: synthetic local Postgres clone, not production data.** No production database was reached in this environment. See `docs/migrations/evidence/d1-cutover-readiness.md` for what that does and does not prove.

### Row counts (Postgres vs D1)

| Table | Postgres | D1 | Match |
| --- | --- | --- | --- |
| user | 3 | 3 | yes |
| account | 1 | 1 | yes |
| session | 1 | 1 | yes |
| verification | 1 | 1 | yes |
| user_social_links | 1 | 1 | yes |
| music_entity_types | 5 | 5 | yes |
| music_platforms | 4 | 4 | yes |
| shows | 3 | 3 | yes |
| show_creators | 1 | 1 | yes |
| show_subscriptions | 0 | 0 | yes |
| audio | 1 | 1 | yes |
| audio_creators | 1 | 1 | yes |
| posts | 1 | 1 | yes |
| post_creators | 1 | 1 | yes |
| music_labels | 1 | 1 | yes |
| music_artists | 2 | 2 | yes |
| music_albums | 1 | 1 | yes |
| music_tracks | 1 | 1 | yes |
| music_playlists | 1 | 1 | yes |
| music_label_creators | 1 | 1 | yes |
| music_label_artists | 1 | 1 | yes |
| music_label_albums | 1 | 1 | yes |
| music_album_artists | 2 | 2 | yes |
| music_track_artists | 2 | 2 | yes |
| music_playlist_tracks | 1 | 1 | yes |
| music_entity_links | 1 | 1 | yes |
| releases | 1 | 1 | yes |
| external_accounts | 1 | 1 | yes |
| external_account_sessions | 1 | 1 | yes |
| bluesky_sync_states | 1 | 1 | yes |
| bluesky_sync_runs | 1 | 1 | yes |
| bluesky_post_sources | 1 | 1 | yes |
| favorites | 1 | 1 | yes |
| navigation_sessions | 1 | 1 | yes |
| navigation_seen_posts | 1 | 1 | yes |
| navigation_trail_entries | 1 | 1 | yes |
| newsletter_subscribers | 1 | 1 | yes |
| user_email_preferences | 1 | 1 | yes |
| music_reminder | 1 | 1 | yes |
| upload_assets | 1 | 1 | yes |
| email_delivery_logs | 1 | 1 | yes |

All 41 tables match on row count.

### Content checksums (stable column ordering, SHA-256 over sorted row fingerprints)

Each row's transformed cells are joined in a fixed target-column order and
JSON-stringified; the set of row fingerprints per table is sorted (so insert
order does not affect the result) and hashed. Postgres-side rows go through
the same `transformValue` function the migration itself uses, so this
checksum compares "what the transform should produce" against "what actually
landed in D1," not two independent re-implementations.

| Table | Match |
| --- | --- |
| user | yes |
| account | yes |
| session | yes |
| verification | yes |
| user_social_links | yes |
| music_entity_types | yes |
| music_platforms | yes |
| shows | yes |
| show_creators | yes |
| show_subscriptions | yes |
| audio | yes |
| audio_creators | yes |
| posts | yes |
| post_creators | yes |
| music_labels | yes |
| music_artists | yes |
| music_albums | yes |
| music_tracks | yes |
| music_playlists | yes |
| music_label_creators | yes |
| music_label_artists | yes |
| music_label_albums | yes |
| music_album_artists | yes |
| music_track_artists | yes |
| music_playlist_tracks | yes |
| music_entity_links | yes |
| releases | yes |
| external_accounts | yes |
| external_account_sessions | yes |
| bluesky_sync_states | yes |
| bluesky_sync_runs | yes |
| bluesky_post_sources | yes |
| favorites | yes |
| navigation_sessions | yes |
| navigation_seen_posts | yes |
| navigation_trail_entries | yes |
| newsletter_subscribers | yes |
| user_email_preferences | yes |
| music_reminder | yes |
| upload_assets | yes |
| email_delivery_logs | yes |

All 41 tables match on content checksum.

### Array column fan-out: labels / entity_labels

Distinct array cells in Postgres source columns vs entity_labels rows in D1, by entity type.

| Entity type | Postgres distinct cells | D1 entity_labels rows | Match |
| --- | --- | --- | --- |
| audio | 2 | 2 | yes |
| show | 3 | 3 | yes |
| release | 2 | 2 | yes |
| post | 2 | 2 | yes |
| artist | 2 | 2 | yes |
| album | 1 | 1 | yes |
| musicLabel | 4 | 4 | yes |

All entity types match between source array cells and entity_labels rows.
`musicLabel` combines both `tags` (2 distinct) and `genres` (2 distinct) fan-outs, both scoped to the same `entityType`.

### Referential integrity (every checked foreign key resolves)

| Check | Orphan rows | OK |
| --- | --- | --- |
| audio.showId -> shows.id | 0 | yes |
| audio_creators.audioId -> audio.id | 0 | yes |
| audio_creators.creatorId -> user.id | 0 | yes |
| posts.parent_post_id -> posts.id | 0 | yes |
| music_tracks.albumId -> music_albums.id | 0 | yes |
| music_album_artists.albumId -> music_albums.id | 0 | yes |
| music_album_artists.artistId -> music_artists.id | 0 | yes |
| music_track_artists.trackId -> music_tracks.id | 0 | yes |
| music_track_artists.artistId -> music_artists.id | 0 | yes |
| music_label_artists.label_id -> music_labels.id | 0 | yes |
| releases.labelId -> music_labels.id | 0 | yes |
| external_accounts.user_id -> user.id | 0 | yes |
| external_account_sessions.external_account_id -> external_accounts.id | 0 | yes |
| favorites.audio_id -> audio.id | 0 | yes |
| entity_labels.label_id -> labels.id | 0 | yes |
| session.user_id -> user.id | 0 | yes |
| account.user_id -> user.id | 0 | yes |

All 17 referential integrity checks pass. This list is a representative
subset of the schema's foreign keys (every content table's primary
relationships, Better Auth's session/account chain, and the polymorphic
`entity_labels` link), not an exhaustive enumeration of every FK in all 43
target tables.

### Sharp-type spot checks

#### PASS: uuid identity: user.id byte-for-byte

```
pg=["11111111-1111-1111-1111-111111111111","22222222-2222-2222-2222-222222222222","33333333-3333-3333-3333-333333333333"]
d1=["11111111-1111-1111-1111-111111111111","22222222-2222-2222-2222-222222222222","33333333-3333-3333-3333-333333333333"]
```

#### PASS: timestamp equality: user.updated_at epoch ms, sub-second precision preserved

```
pg_epoch_ms=1704146400123 d1_epoch_ms=1704146400123
```

Source value was `2024-01-02T00:00:00.123Z`; the `.123` survives.

#### PASS: boolean translation: user.email_verified 0/1

```
pg=[{"id":"1111...","value":1},{"id":"2222...","value":1},{"id":"3333...","value":0}]
d1=[{"id":"1111...","value":1},{"id":"2222...","value":1},{"id":"3333...","value":0}]
```

Both `true` and `false` source rows checked.

#### PASS: jsonb round-trip: CiphertextEnvelope (app_password, session) exact match

Checked 1 `external_account_sessions` row containing base64-like `iv`,
`authTag`, and `payload` fields with special characters (`~`, `` ` ``, `!`,
`$`, `%`, `^`, `&`, `*`, `(`, `)`). Both `app_password` and `session`
columns round-tripped exactly: parsed D1 JSON text deep-equals the Postgres
jsonb value.

#### PASS: tag/genre order preservation: music_labels.tags and .genres via entity_labels.position

```
99999999-.../tag:   expected=["indie","vinyl-only"] actual=["indie","vinyl-only"] match=true
99999999-.../genre: expected=["house","techno"]     actual=["house","techno"]     match=true
```

Source `genres` array was `['house','techno','house']` (a duplicate); the
migration's `distinct()` step de-duplicates before assigning `position`, and
the de-duplicated order round-trips through `entity_labels.position` exactly.

#### PASS: artistNames stays denormalized JSON text, order preserved verbatim (not fanned out)

Checked 1 `music_tracks` row where `artistNames` was seeded in the opposite
order from the corresponding `music_track_artists` join rows
(`['Second Artist','DJ Test']` vs join `displayOrder` giving `DJ Test` then
`Second Artist`), specifically to prove the migration copies the JSON column
verbatim rather than deriving it from the join table. The D1 value matches
the Postgres source exactly, confirming no derivation occurred.

All 6 sharp-type spot checks pass.

## Overall result

**PASS** — all checks above passed, against the synthetic dataset described
in "Methodology." This is not evidence of correctness at production scale or
against production's actual data shapes; see `d1-cutover-readiness.md`.

## Sharp types actually exercised vs only reasoned about

| Sharp type | Exercised by an automated check | Notes |
| --- | --- | --- |
| uuid byte-for-byte identity | Yes | `user.id`, plus every table's row-count/checksum implicitly re-checks every PK/FK uuid used to join rows |
| timestamp -> epoch ms, UTC preserved | Yes | Sub-second precision explicitly seeded and checked |
| boolean -> 0/1 | Yes | Both true/false checked |
| jsonb -> text, CiphertextEnvelope round-trip | Yes | The specific sharp case named in the task |
| jsonb -> text, other jsonb columns (`music_entity_links.metadata`, `bluesky_post_sources.source_facets`/`source_embeds`, `releases.streamingLinks`, `email_delivery_logs.metadata`) | Indirectly, via table checksums only | No dedicated spot check per column; the per-table checksum would catch a JSON-serialization drift on these but there is no targeted assertion isolating them the way CiphertextEnvelope has one |
| array columns -> labels/entity_labels, all 9 columns across 8 tables | Yes | Every fan-out column populated with duplicates, unicode, empty array, and NULL; row counts verified per entity type |
| entity_labels.position preserves source array order | Yes | Explicit before/after order comparison, including a duplicate-collapsing case |
| artistNames stays denormalized JSON, not fanned out | Yes | Deliberately seeded in conflicting order vs the join table to prove no derivation |
| `DESC NULLS LAST` / SQLite null ordering semantics | No | Out of scope for this script; M3's evidence (`d1-transaction-classification.md` era work) covers ordering separately, not re-verified here |
| FTS5 trigram search results | No — only indirectly, via the fact that FTS trigger-populated tables didn't error during import | No fixture comparison was run; M1's search fixture is the documented pass criterion and was not re-run as part of M5 |
| D1 `batch()` atomicity under a genuinely failing statement | No | Every seeded row was valid; no test forced a mid-batch failure to confirm the batch rolls back atomically |
| Idempotent re-run | Yes | Migration run twice back to back; second run inserted 0 new label rows and reproduced identical entity_labels; verification passed identically both times |
| Verification actually detects drift (not a rubber stamp) | Yes | A Postgres row was mutated after migrating; verification failed with a checksum mismatch and non-zero exit code, then passed again after re-migrating |

## Files

- `apps/server/scripts/migrate-pg-to-d1.ts` — the migration script (export, transform, import; idempotent)
- `apps/server/scripts/verify-pg-to-d1.ts` — the verification script that produced this report
- Seed SQL and the out-of-tree `drizzle.config.migration-src.ts` used to stand up the synthetic source were kept outside the working tree (`/tmp/gbfm-migration/`) per the task's "do not commit any dump file" instruction, and are not part of this commit. Re-create them from "How to reproduce" above if this needs to be re-run.
