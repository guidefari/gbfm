# Label music entity migration

Issue: [#109](https://github.com/guidefari/gbfm/issues/109)

## Deployment path

1. Back up the production database with `bun --cwd apps/vps run db:backup:prod`.
2. Deploy the application normally. `apps/vps/src/migrate.ts` applies migrations before starting the server.
3. Migration `0041_loving_hobgoblin.sql` creates `music_labels` and `music_label_creators` without changing existing data.
4. Migration `0042_sudden_natasha_romanoff.sql` copies and validates all label content, creator relationships, and external links before replacing the legacy tables. It leaves `created_by_id` null (legacy data had no singular creator).
6. Confirm `/labels`, a representative `/labels/:slug`, and `/admin/music` after deployment.

## Field mapping

| Legacy label | Music label |
| --- | --- |
| `id` | `id` |
| `title` | `name` |
| `thumbnailUrl` | `image_url` |
| `bannerImageUrl` | `banner_image_url` |
| `description` | `description` |
| `slug` | `slug` |
| `content` | `content` |
| `tags` | `tags` |
| `genres` | `genres` |
| `draft = false` | `published_at = createdAt` |
| `draft = true` | `published_at = null` |
| `website`, `bandcamp`, `discogs` | verified `music_entity_links` |
| `label_creators` | `music_label_creators` |
| (no singular creator) | `created_by_id = NULL` |

Label UUIDs and timestamps are unchanged. Existing `releases.labelId` values therefore remain valid and are repointed to `music_labels.id` without rewriting release rows.

`created_by_id` is not backfilled from `label_creators`. The legacy junction was many-to-many and never recorded which creator created the label. Ownership stays in `music_label_creators`. Environments that already ran the earlier migration cannot safely distinguish fabricated values from legitimate post-cutover provenance, so no destructive blanket correction is applied.

If duplicate legacy slugs exist, the earliest record retains the original slug. Later records receive a deterministic `-migrated-<UUID>` suffix. Long slugs are truncated before the suffix, and the migration retries with a UUID-based fallback if a generated slug conflicts with another legacy slug, so no content is discarded.

## Integrity gates

The destructive phase aborts before dropping legacy tables unless all of these conditions pass:

- Legacy and migrated label counts match.
- Legacy and migrated creator relationship counts match.
- Every release resolves to a migrated label.
- Every non-empty legacy external URL has a migrated entity link.

If a gate fails, the migration transaction fails and the legacy tables remain available. Correct the source data and rerun the deployment. If a post-deployment rollback is required, restore the pre-deployment backup because this is an intentional clean cut with no dual-read period.
