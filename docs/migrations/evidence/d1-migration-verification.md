# D1 migration verification (OPS-249)

Generated 2026-08-10T14:46:11.211Z.

**Data source: read-only production pg_dump, restored to a local throwaway Postgres.**

## Row counts (Postgres vs D1)

| Table | Postgres | D1 | Match |
| --- | --- | --- | --- |
| user | 19 | 19 | yes |
| account | 18 | 18 | yes |
| session | 107 | 107 | yes |
| verification | 4 | 4 | yes |
| user_social_links | 11 | 11 | yes |
| music_entity_types | 5 | 5 | yes |
| music_platforms | 16 | 16 | yes |
| shows | 2 | 2 | yes |
| show_creators | 2 | 2 | yes |
| show_subscriptions | 3 | 3 | yes |
| audio | 28 | 28 | yes |
| audio_creators | 28 | 28 | yes |
| posts | 227 | 227 | yes |
| post_creators | 227 | 227 | yes |
| music_labels | 15 | 15 | yes |
| music_artists | 119 | 119 | yes |
| music_albums | 35 | 35 | yes |
| music_tracks | 229 | 229 | yes |
| music_playlists | 7 | 7 | yes |
| music_label_creators | 15 | 15 | yes |
| music_label_artists | 0 | 0 | yes |
| music_label_albums | 0 | 0 | yes |
| music_album_artists | 33 | 33 | yes |
| music_track_artists | 121 | 121 | yes |
| music_playlist_tracks | 137 | 137 | yes |
| music_entity_links | 838 | 838 | yes |
| releases | 2 | 2 | yes |
| external_accounts | 1 | 1 | yes |
| external_account_sessions | 1 | 1 | yes |
| bluesky_sync_states | 1 | 1 | yes |
| bluesky_sync_runs | 7 | 7 | yes |
| bluesky_post_sources | 47 | 47 | yes |
| favorites | 12 | 12 | yes |
| navigation_sessions | 8 | 8 | yes |
| navigation_seen_posts | 16 | 16 | yes |
| navigation_trail_entries | 16 | 16 | yes |
| newsletter_subscribers | 11 | 11 | yes |
| user_email_preferences | 8 | 8 | yes |
| music_reminder | 29 | 29 | yes |
| upload_assets | 1 | 1 | yes |
| email_delivery_logs | 127 | 127 | yes |

All 41 tables match on row count.

## Content checksums (stable column ordering, SHA-256 over sorted row fingerprints)

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

## Array column fan-out: labels / entity_labels

Distinct array cells in Postgres source columns vs entity_labels rows in D1, by entity type.

| Entity type | Postgres distinct cells | D1 entity_labels rows | Match |
| --- | --- | --- | --- |
| audio | 9 | 9 | yes |
| show | 0 | 0 | yes |
| release | 0 | 0 | yes |
| post | 75 | 75 | yes |
| artist | 0 | 0 | yes |
| album | 1 | 1 | yes |
| musicLabel | 61 | 61 | yes |

All entity types match between source array cells and entity_labels rows.

## Referential integrity (every checked foreign key resolves)

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

All 17 referential integrity checks pass.

### Exhaustive D1 foreign-key check

PASS: `pragma foreign_key_check` returned 0 violation rows.

## Sharp-type spot checks

### PASS: uuid identity: user.id byte-for-byte

checked 19 user row(s)

### PASS: timestamp equality: user.updated_at epoch ms

checked 19 user row(s) at epoch-ms precision

### PASS: boolean translation: user.email_verified 0/1

checked 19 user row(s)

### PASS: jsonb round-trip: CiphertextEnvelope (app_password, session) exact match

checked 1 external_account_sessions row(s)

### PASS: array fan-out order: all nine source columns via entity_labels.position

checked 443 source array cell(s)

### PASS: artistNames stays denormalized JSON text, order preserved verbatim (not fanned out)

checked 264 music album and track row(s)

All 6 sharp-type spot checks pass.

## Overall result

**PASS:** all checks above passed.
