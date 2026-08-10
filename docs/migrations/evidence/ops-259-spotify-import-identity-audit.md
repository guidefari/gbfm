# OPS-259 Spotify Import Identity Audit

Audit date: 2026-08-10. Production was queried through a read-only transaction.
No production data was changed. URLs and entity details are redacted.

## Query

The audit grouped `music_entity_links` by `(entityType, platform, url)` and
selected groups with more than one distinct `entityId`. It then joined each
entity type to its entity table to compare title and slug values.

## Findings

| Scope                          | Shared-URL groups | Referenced entities |
| ------------------------------ | ----------------: | ------------------: |
| All entity types and platforms |                51 |                 104 |
| Spotify tracks and playlists   |                 8 |                  16 |
| Spotify playlists              |                 0 |                   0 |

Redacted global examples:

| Entity type | Platform     | Entities for one redacted URL |
| ----------- | ------------ | ----------------------------: |
| album       | spotify      |                             3 |
| album       | tidal        |                             3 |
| album       | amazon_music |                             2 |
| track       | spotify      |                             2 |
| track       | tidal        |                             2 |

All 51 groups had the same entity title within the group and distinct slugs
with generated suffixes. The eight scoped Spotify groups are all tracks with
two entities each. They are historical duplicates, not legitimate cases where
one Spotify track belongs to different domain entities.

## Decision

Do not add a partial unique index yet. The eight existing Spotify-track groups
mean that creating the proposed partial index would fail on production data.
Any migration that removed rows to make the index apply would repeat the
OPS-249 data-loss risk, so it cannot prove a zero-row-loss application.

A Durable Object keyed by the existing Spotify URL and entity type instead
serializes each resolve-and-create operation. It preserves every existing row,
prevents new concurrent duplicates, and does not redefine link identity. A
future repair can reconcile the eight historical duplicate groups deliberately.
