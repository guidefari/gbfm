# D1 database sizing (OPS-249)

Measured 2026-08-10 from production Postgres through an SST production shell.
All production queries were read-only aggregate queries. No row contents, IDs,
emails, tokens, or other personal data were retained.

## Result

| Measure | Bytes | Human-readable |
| --- | ---: | ---: |
| Whole PostgreSQL database | 13,604,543 | 12.97 MiB |
| Application table heaps | 1,024,000 | 0.98 MiB |
| Application indexes | 2,252,800 | 2.15 MiB |
| Application relations, including indexes and auxiliary storage | 4,218,880 | 4.02 MiB |
| Production dump, custom compressed format | 365,365 | 0.35 MiB |
| D1 cap | 10,000,000,000 | 10 GB |

The whole production database is 0.136% of the 10 GB D1 cap, leaving about
9.99 GB of nominal headroom. The cap is not a cutover concern at this size.
This does not predict the final D1 file size, including FTS5, but the margin is
about 735 times the current whole-database size.

## Per-table measurements

`table bytes` is `pg_relation_size`; `index bytes` is `pg_indexes_size`; and
`total bytes` is `pg_total_relation_size`. The 41 application tables exclude
Drizzle migration metadata.

| Table | Rows | Table bytes | Index bytes | Total bytes |
| --- | ---: | ---: | ---: | ---: |
| music_entity_links | 838 | 245,760 | 221,184 | 499,712 |
| posts | 227 | 139,264 | 188,416 | 434,176 |
| audio | 28 | 90,112 | 147,456 | 319,488 |
| music_tracks | 229 | 73,728 | 98,304 | 204,800 |
| email_delivery_logs | 127 | 40,960 | 81,920 | 163,840 |
| bluesky_post_sources | 47 | 32,768 | 65,536 | 131,072 |
| music_reminder | 29 | 16,384 | 81,920 | 131,072 |
| session | 107 | 32,768 | 49,152 | 122,880 |
| user | 19 | 16,384 | 65,536 | 122,880 |
| music_labels | 15 | 16,384 | 49,152 | 114,688 |
| post_creators | 227 | 24,576 | 57,344 | 114,688 |
| upload_assets | 1 | 8,192 | 98,304 | 114,688 |
| music_albums | 35 | 16,384 | 49,152 | 98,304 |
| music_artists | 119 | 16,384 | 49,152 | 98,304 |
| newsletter_subscribers | 11 | 8,192 | 81,920 | 98,304 |
| account | 18 | 16,384 | 32,768 | 90,112 |
| favorites | 12 | 8,192 | 65,536 | 81,920 |
| show_subscriptions | 3 | 8,192 | 65,536 | 81,920 |
| shows | 2 | 16,384 | 32,768 | 81,920 |
| music_playlist_tracks | 137 | 16,384 | 32,768 | 73,728 |
| external_accounts | 1 | 8,192 | 49,152 | 65,536 |
| music_platforms | 16 | 8,192 | 16,384 | 65,536 |
| music_playlists | 7 | 8,192 | 49,152 | 65,536 |
| navigation_sessions | 8 | 8,192 | 49,152 | 65,536 |
| user_email_preferences | 8 | 8,192 | 49,152 | 65,536 |
| user_social_links | 11 | 8,192 | 49,152 | 65,536 |
| music_entity_types | 5 | 8,192 | 16,384 | 57,344 |
| music_track_artists | 121 | 16,384 | 16,384 | 57,344 |
| audio_creators | 28 | 8,192 | 32,768 | 49,152 |
| bluesky_sync_runs | 7 | 8,192 | 32,768 | 49,152 |
| external_account_sessions | 1 | 8,192 | 32,768 | 49,152 |
| navigation_trail_entries | 16 | 8,192 | 32,768 | 49,152 |
| releases | 2 | 8,192 | 32,768 | 49,152 |
| show_creators | 2 | 8,192 | 32,768 | 49,152 |
| verification | 4 | 8,192 | 32,768 | 49,152 |
| bluesky_sync_states | 1 | 8,192 | 16,384 | 32,768 |
| music_label_albums | 0 | 8,192 | 24,576 | 32,768 |
| music_label_artists | 0 | 8,192 | 24,576 | 32,768 |
| music_label_creators | 15 | 8,192 | 16,384 | 32,768 |
| navigation_seen_posts | 16 | 8,192 | 16,384 | 32,768 |
| music_album_artists | 33 | 8,192 | 16,384 | 24,576 |

The largest individual indexes were all small: 80 KiB for the
`music_entity_links` uniqueness index; 56 KiB for its primary key; 48 KiB for
its entity lookup index; and 40 KiB each for two `music_tracks` slug indexes,
the `post_creators` primary key, and the `posts` slug index.

## Write activity

A peak write rate was not observable from the available read-only statistics.
`pg_stat_database.stats_reset` was null, so its counters have no known start
time. They therefore cannot support a rate calculation. At the measurement:

- `pg_stat_database` recorded 227,371 committed and 77 rolled-back
  transactions, plus 1,629 inserted, 1,825 updated, and 135 deleted tuples.
- Summing `pg_stat_user_tables` gave 728 inserts, 1,593 updates, and 84
  deletes. These counters also have no known start time and differ from the
  database counters because their scope differs.
- Three database connections were active.

These are cumulative counters, not a peak or a time-window sample. The D1
write-serialization load test remains a cutover blocker.
