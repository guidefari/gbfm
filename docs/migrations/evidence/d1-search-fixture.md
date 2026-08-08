# D1 Search and Ordering Fixture

Captured 2026-08-09 from a local PostgreSQL 17 Docker container. The search
queries reproduce `apps/vps/src/services/search.service.ts`: each entity group
matches published rows where title, description, content, or one tag satisfies
`ILIKE '%' || query || '%'`, with a per-group limit of 20.

The source does not specify an `ORDER BY`. Expected result lists below are
therefore exact sets, normalized by slug for stable comparison. M3 must not add
an ordering assertion unless it deliberately changes the API contract.

## Local Database Method

The fixture used an isolated `postgres:17-alpine` container on `127.0.0.1:5433`.
The tracked SQL migration chain has no clean empty-database bootstrap, as
recorded in `BLOCKERS.md`. A throwaway bootstrap generated from the tracked
`drizzle/meta/0000_snapshot.json` was used, then all tracked migration SQL was
applied. Two redundant historical constraint drops in
`0013_curvy_adam_warlock.sql` were omitted because the preceding `DROP TABLE ...
CASCADE` had already removed them. No production database, credential, schema,
or data was accessed.

## Seed Data

All IDs are fixed UUIDs. All omitted nullable fields are `NULL` and all omitted
audit timestamps use their database defaults.

| Entity | ID | Title | Slug | Description | Content | Tags | Draft |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Show | `11111111-1111-1111-1111-111111111111` | Aurora Signals | `aurora-signals` | Night Signal Dispatch | A transmission from the cosmos. | `stargaze` | false |
| Show | `44444444-4444-4444-4444-444444444444` | Cinder Club | `cinder-club` | Ashes after the broadcast | Embers in the studio. | `fire` | false |
| Show | `77777777-7777-7777-7777-777777777777` | Aurora Draft | `aurora-draft` | Unpublished Aurora material | This must be hidden. | `stargaze` | true |
| Audio | `22222222-2222-2222-2222-222222222222` | Aurora Night Mix | `aurora-night-mix` | A midnight waveform. | Signal archive for night listeners. | `deep-space` | false |
| Audio | `55555555-5555-5555-5555-555555555555` | Ember Session | `ember-session` | Warm analogue tones. | Coals and static. | `fire` | false |
| Post | `33333333-3333-3333-3333-333333333333` | Aurora Dispatch | `aurora-dispatch` | A field note from the station. | Midnight! Decode the signal. | `relay` | false |
| Post | `66666666-6666-6666-6666-666666666666` | Coal Notes | `coal-notes` | Warm notes. | Ash and static. | `fire` | false |

The Aurora audio is linked to the Aurora show. It has no thumbnail, so the
current service returns the show's thumbnail and `showSlug: 'aurora-signals'`.

## Search Expectations

Empty cells mean an empty result group. The draft show must never appear.

| Query | Shows | Audio | Posts | Coverage |
| --- | --- | --- | --- | --- |
| `aurora` | `aurora-signals` | `aurora-night-mix` | `aurora-dispatch` | Single word |
| `night signal` | `aurora-signals` |  |  | Multi-word contiguous substring |
| `rora` | `aurora-signals` | `aurora-night-mix` | `aurora-dispatch` | Mid-word substring, critical FTS5 compatibility case |
| `stargaze` | `aurora-signals` |  |  | Show tag only |
| `deep-space` |  | `aurora-night-mix` |  | Audio tag only |
| `relay` |  |  | `aurora-dispatch` | Post tag only |
| `AuRoRa` | `aurora-signals` | `aurora-night-mix` | `aurora-dispatch` | Case-insensitive match |
| `` | `aurora-signals`, `cinder-club` | `aurora-night-mix`, `ember-session` | `aurora-dispatch`, `coal-notes` | Empty query uses `%%`, so every published row matches |
| `midnight!` |  |  | `aurora-dispatch` | Punctuation in content |

The `rora` row is the primary FTS5 regression criterion. Default FTS5 tokenizing
will not preserve it; the updated migration specification selects FTS5 trigram
tokenization, with a separate `LIKE` fallback required for one- and two-character
queries.

## Postgres Ordering Fixture

This captures the two `DESC NULLS LAST` orderings in
`apps/vps/src/services/music-entity/label-affiliation.service.ts:100,125`.
The fixture label is `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`; all five albums are
published so both methods must produce the same output.

| Title | Release date | Expected ordinal |
| --- | --- | ---: |
| Alpha 2024 | `2024-06-01` | 1 |
| Beta 2024 | `2024-06-01` | 2 |
| Gamma 2022 | `2022-01-01` | 3 |
| Alpha Null | `NULL` | 4 |
| Zulu Null | `NULL` | 5 |

Postgres query and captured output:

```sql
SELECT title, "releaseDate"
FROM music_label_albums
INNER JOIN music_albums ON music_label_albums.album_id = music_albums.id
WHERE label_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
ORDER BY "releaseDate" DESC NULLS LAST, title ASC;

Alpha 2024 | 2024-06-01
Beta 2024  | 2024-06-01
Gamma 2022 | 2022-01-01
Alpha Null | NULL
Zulu Null  | NULL
```

The current Postgres table uses quoted camel-case `"releaseDate"`, as shown in
the captured query. M3's SQLite schema uses `release_date`, and its query must
explicitly emulate this ordering, for example with `release_date IS NULL ASC,
release_date DESC, title ASC`, because SQLite sorts nulls first for a plain
descending sort.

## Reproduction Queries

The following query emits the normalized search expectation rows from the seed:

```sql
WITH q(position, query) AS (
  VALUES
    (1, 'aurora'), (2, 'night signal'), (3, 'rora'), (4, 'stargaze'),
    (5, 'deep-space'), (6, 'relay'), (7, 'AuRoRa'), (8, ''), (9, 'midnight!')
)
SELECT q.query, 'shows' AS entity, array_agg(s.slug ORDER BY s.slug)
FROM q
LEFT JOIN shows AS s ON NOT s.draft AND (
  s.title ILIKE '%' || q.query || '%' OR
  s.description ILIKE '%' || q.query || '%' OR
  s.content ILIKE '%' || q.query || '%' OR
  EXISTS (SELECT 1 FROM unnest(s.tags) AS t WHERE t ILIKE '%' || q.query || '%')
)
GROUP BY q.position, q.query
ORDER BY q.position;
```

Run the equivalent query for `audio` and `posts`, using their matching fields,
or invoke `SearchService.search(query, 20)` against this seed. The expected sets
are the table above.

Production database size and peak write-rate measurements remain outstanding.
They must be collected by a human with authorized production access; this audit
did not seek or use production access.
