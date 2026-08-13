#!/usr/bin/env bun
/**
 * Postgres -> D1 data migration (OPS-249 / M5).
 *
 * Exports every row from the source Postgres database, transforms it to the
 * D1/SQLite shapes documented in docs/migrations/postgres-to-d1.md, and
 * imports into a target D1 database (local Miniflare-backed, or a real
 * wrangler-managed D1 reached through the same Database binding shape).
 *
 * Idempotent: every insert is `INSERT OR REPLACE`, so re-running against the
 * same target overwrites rather than duplicates. Tables are imported in
 * dependency order so foreign keys always resolve.
 *
 * Usage:
 *   bun run scripts/migrate-pg-to-d1.ts
 *
 * Source Postgres connection (falls back to the local docker-compose values):
 *   PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE
 *
 * Target D1: a local Miniflare-backed database persisted to D1_PERSIST_PATH
 * (default ./.migration-d1) unless D1_PERSIST_PATH=":memory:" is set.
 *
 * Setting D1_DATABASE_ID instead targets a deployed D1 through the REST API
 * (see remote-d1.ts), which also needs CLOUDFLARE_API_TOKEN and
 * CLOUDFLARE_DEFAULT_ACCOUNT_ID. This overwrites the deployed database.
 */

import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
import { readFile } from 'node:fs/promises'
import { Miniflare } from 'miniflare'
import { Client, types } from 'pg'
import { createRemoteD1, remoteD1OptionsFromEnv } from './remote-d1'

/**
 * `timestamp without time zone` columns (auth.schema.ts's user/session/etc.)
 * carry no timezone in Postgres. node-postgres's default type parser treats
 * their text as a local wall-clock time in the running process's OS
 * timezone, so the same row parses to a different instant depending on
 * where this script runs. Production's deployed server reads that same text
 * as UTC. Override the parser for both timestamp OIDs (1114 = timestamp,
 * 1184 = timestamptz) so migrated values are deterministic and match
 * production regardless of the machine's local TZ.
 */
const TIMESTAMP_OID = 1114
const TIMESTAMPTZ_OID = 1184
types.setTypeParser(TIMESTAMP_OID, (value: string) => `${value.replace(' ', 'T')}Z`)
types.setTypeParser(TIMESTAMPTZ_OID, (value: string) => value)

type Row = Record<string, unknown>

type TableSpec = {
  readonly source: string
  readonly target: string
  readonly columns: ReadonlyArray<ColumnSpec>
  readonly selfReferenceColumns?: ReadonlyArray<string>
}

type ColumnKind = 'text' | 'timestamp' | 'boolean' | 'json' | 'integer' | 'ses-provider'

type ColumnSpec = {
  readonly source: string
  readonly target: string
  readonly kind: ColumnKind
}

const col = (source: string, target: string, kind: ColumnKind): ColumnSpec => ({
  source,
  target,
  kind
})

const same = (name: string, kind: ColumnKind): ColumnSpec => col(name, name, kind)

/**
 * Nine array columns fan out into labels/entity_labels instead of a plain
 * column copy. entityType matches the tags.schema.ts discriminator.
 */
type ArrayFanOut = {
  readonly sourceTable: string
  readonly entityType: string
  readonly kind: 'tag' | 'genre'
  readonly column: string
}

const ARRAY_FAN_OUTS: ReadonlyArray<ArrayFanOut> = [
  { sourceTable: 'audio', entityType: 'audio', kind: 'tag', column: 'tags' },
  { sourceTable: 'shows', entityType: 'show', kind: 'tag', column: 'tags' },
  { sourceTable: 'releases', entityType: 'release', kind: 'tag', column: 'tags' },
  { sourceTable: 'posts', entityType: 'post', kind: 'tag', column: 'tags' },
  { sourceTable: 'music_artists', entityType: 'artist', kind: 'genre', column: 'genres' },
  { sourceTable: 'music_albums', entityType: 'album', kind: 'genre', column: 'genres' },
  { sourceTable: 'music_labels', entityType: 'musicLabel', kind: 'tag', column: 'tags' },
  { sourceTable: 'music_labels', entityType: 'musicLabel', kind: 'genre', column: 'genres' }
]

/**
 * Plain (non-fan-out) tables, ordered so every foreign key target is
 * imported before the row referencing it.
 */
const TABLES: ReadonlyArray<TableSpec> = [
  {
    source: 'user',
    target: 'user',
    columns: [
      same('id', 'text'),
      same('name', 'text'),
      same('email', 'text'),
      col('email_verified', 'email_verified', 'boolean'),
      same('image', 'text'),
      same('bio', 'text'),
      col('created_at', 'created_at', 'timestamp'),
      col('updated_at', 'updated_at', 'timestamp'),
      same('username', 'text'),
      same('display_username', 'text'),
      same('role', 'text'),
      col('banned', 'banned', 'boolean'),
      col('ban_reason', 'ban_reason', 'text'),
      col('ban_expires', 'ban_expires', 'timestamp')
    ]
  },
  {
    source: 'account',
    target: 'account',
    columns: [
      same('id', 'text'),
      col('account_id', 'account_id', 'text'),
      col('provider_id', 'provider_id', 'text'),
      col('user_id', 'user_id', 'text'),
      col('access_token', 'access_token', 'text'),
      col('refresh_token', 'refresh_token', 'text'),
      col('id_token', 'id_token', 'text'),
      col('access_token_expires_at', 'access_token_expires_at', 'timestamp'),
      col('refresh_token_expires_at', 'refresh_token_expires_at', 'timestamp'),
      same('scope', 'text'),
      same('password', 'text'),
      col('created_at', 'created_at', 'timestamp'),
      col('updated_at', 'updated_at', 'timestamp')
    ]
  },
  {
    source: 'session',
    target: 'session',
    columns: [
      same('id', 'text'),
      col('expires_at', 'expires_at', 'timestamp'),
      same('token', 'text'),
      col('created_at', 'created_at', 'timestamp'),
      col('updated_at', 'updated_at', 'timestamp'),
      col('ip_address', 'ip_address', 'text'),
      col('user_agent', 'user_agent', 'text'),
      col('user_id', 'user_id', 'text'),
      col('impersonated_by', 'impersonated_by', 'text')
    ]
  },
  {
    source: 'verification',
    target: 'verification',
    columns: [
      same('id', 'text'),
      same('identifier', 'text'),
      same('value', 'text'),
      col('expires_at', 'expires_at', 'timestamp'),
      col('created_at', 'created_at', 'timestamp'),
      col('updated_at', 'updated_at', 'timestamp')
    ]
  },
  {
    source: 'user_social_links',
    target: 'user_social_links',
    columns: [
      same('id', 'text'),
      col('user_id', 'user_id', 'text'),
      same('platform', 'text'),
      same('url', 'text'),
      same('position', 'integer'),
      col('created_at', 'created_at', 'timestamp'),
      col('updated_at', 'updated_at', 'timestamp')
    ]
  },
  {
    source: 'music_entity_types',
    target: 'music_entity_types',
    columns: [same('id', 'text'), col('displayName', 'displayName', 'text')]
  },
  {
    source: 'music_platforms',
    target: 'music_platforms',
    columns: [
      same('id', 'text'),
      col('displayName', 'displayName', 'text'),
      col('websiteUrl', 'websiteUrl', 'text'),
      col('iconUrl', 'iconUrl', 'text')
    ]
  },
  {
    source: 'shows',
    target: 'shows',
    columns: [
      same('id', 'text'),
      same('title', 'text'),
      same('description', 'text'),
      col('thumbnailUrl', 'thumbnailUrl', 'text'),
      col('bannerImageUrl', 'bannerImageUrl', 'text'),
      same('slug', 'text'),
      col('createdAt', 'createdAt', 'timestamp'),
      col('updatedAt', 'updatedAt', 'timestamp'),
      col('draft', 'draft', 'boolean'),
      same('content', 'text')
    ]
  },
  {
    source: 'show_creators',
    target: 'show_creators',
    columns: [col('showId', 'showId', 'text'), col('creatorId', 'creatorId', 'text')]
  },
  {
    source: 'show_subscriptions',
    target: 'show_subscriptions',
    columns: [
      same('id', 'text'),
      col('userId', 'userId', 'text'),
      col('showId', 'showId', 'text'),
      col('createdAt', 'createdAt', 'timestamp')
    ]
  },
  {
    source: 'audio',
    target: 'audio',
    columns: [
      same('id', 'text'),
      same('title', 'text'),
      same('description', 'text'),
      col('thumbnailUrl', 'thumbnailUrl', 'text'),
      col('bannerImageUrl', 'bannerImageUrl', 'text'),
      same('slug', 'text'),
      col('createdAt', 'createdAt', 'timestamp'),
      col('updatedAt', 'updatedAt', 'timestamp'),
      col('draft', 'draft', 'boolean'),
      same('content', 'text'),
      same('type', 'text'),
      same('url', 'text'),
      col('idempotencyKey', 'idempotencyKey', 'text'),
      col('idempotencyActorId', 'idempotencyActorId', 'text'),
      col('idempotencyFingerprint', 'idempotencyFingerprint', 'text'),
      col('showId', 'showId', 'text'),
      col('episodeNumber', 'episodeNumber', 'integer'),
      col('playCount', 'playCount', 'integer')
    ]
  },
  {
    source: 'audio_creators',
    target: 'audio_creators',
    columns: [col('audioId', 'audioId', 'text'), col('creatorId', 'creatorId', 'text')]
  },
  {
    source: 'posts',
    target: 'posts',
    selfReferenceColumns: ['parent_post_id', 'root_post_id', 'quoted_post_id'],
    columns: [
      same('id', 'text'),
      same('title', 'text'),
      same('description', 'text'),
      col('thumbnailUrl', 'thumbnailUrl', 'text'),
      col('bannerImageUrl', 'bannerImageUrl', 'text'),
      same('slug', 'text'),
      col('createdAt', 'createdAt', 'timestamp'),
      col('updatedAt', 'updatedAt', 'timestamp'),
      col('draft', 'draft', 'boolean'),
      same('content', 'text'),
      same('type', 'text'),
      col('music_entity_type', 'music_entity_type', 'text'),
      col('music_entity_id', 'music_entity_id', 'text'),
      col('parent_post_id', 'parent_post_id', 'text'),
      col('root_post_id', 'root_post_id', 'text'),
      same('depth', 'integer'),
      col('quoted_post_id', 'quoted_post_id', 'text')
    ]
  },
  {
    source: 'post_creators',
    target: 'post_creators',
    columns: [col('postId', 'postId', 'text'), col('creatorId', 'creatorId', 'text')]
  },
  {
    source: 'music_labels',
    target: 'music_labels',
    columns: [
      same('id', 'text'),
      same('name', 'text'),
      same('description', 'text'),
      col('image_url', 'image_url', 'text'),
      col('banner_image_url', 'banner_image_url', 'text'),
      same('slug', 'text'),
      same('content', 'text'),
      col('published_at', 'published_at', 'timestamp'),
      col('created_by_id', 'created_by_id', 'text'),
      col('created_at', 'created_at', 'timestamp'),
      col('updated_at', 'updated_at', 'timestamp')
    ]
  },
  {
    source: 'music_artists',
    target: 'music_artists',
    columns: [
      same('id', 'text'),
      same('name', 'text'),
      same('bio', 'text'),
      col('imageUrl', 'imageUrl', 'text'),
      same('slug', 'text'),
      col('publishedAt', 'publishedAt', 'timestamp'),
      col('createdById', 'createdById', 'text'),
      col('createdAt', 'createdAt', 'timestamp'),
      col('updatedAt', 'updatedAt', 'timestamp')
    ]
  },
  {
    source: 'music_albums',
    target: 'music_albums',
    columns: [
      same('id', 'text'),
      same('title', 'text'),
      col('artistNames', 'artistNames', 'json'),
      col('releaseDate', 'releaseDate', 'timestamp'),
      col('coverImageUrl', 'coverImageUrl', 'text'),
      col('albumType', 'albumType', 'text'),
      same('slug', 'text'),
      col('publishedAt', 'publishedAt', 'timestamp'),
      col('createdById', 'createdById', 'text'),
      col('createdAt', 'createdAt', 'timestamp'),
      col('updatedAt', 'updatedAt', 'timestamp')
    ]
  },
  {
    source: 'music_tracks',
    target: 'music_tracks',
    columns: [
      same('id', 'text'),
      same('title', 'text'),
      col('artistNames', 'artistNames', 'json'),
      col('coverImageUrl', 'coverImageUrl', 'text'),
      col('albumId', 'albumId', 'text'),
      col('trackNumber', 'trackNumber', 'integer'),
      same('slug', 'text'),
      col('publishedAt', 'publishedAt', 'timestamp'),
      col('createdById', 'createdById', 'text'),
      col('createdAt', 'createdAt', 'timestamp'),
      col('updatedAt', 'updatedAt', 'timestamp')
    ]
  },
  {
    source: 'music_playlists',
    target: 'music_playlists',
    columns: [
      same('id', 'text'),
      same('title', 'text'),
      same('description', 'text'),
      col('coverImageUrl', 'coverImageUrl', 'text'),
      col('curatorId', 'curatorId', 'text'),
      same('slug', 'text'),
      col('publishedAt', 'publishedAt', 'timestamp'),
      col('createdById', 'createdById', 'text'),
      col('createdAt', 'createdAt', 'timestamp'),
      col('updatedAt', 'updatedAt', 'timestamp')
    ]
  },
  {
    source: 'music_label_creators',
    target: 'music_label_creators',
    columns: [col('label_id', 'label_id', 'text'), col('creator_id', 'creator_id', 'text')]
  },
  {
    source: 'music_label_artists',
    target: 'music_label_artists',
    columns: [col('label_id', 'label_id', 'text'), col('artist_id', 'artist_id', 'text')]
  },
  {
    source: 'music_label_albums',
    target: 'music_label_albums',
    columns: [col('label_id', 'label_id', 'text'), col('album_id', 'album_id', 'text')]
  },
  {
    source: 'music_album_artists',
    target: 'music_album_artists',
    columns: [
      col('albumId', 'albumId', 'text'),
      col('artistId', 'artistId', 'text'),
      col('displayOrder', 'displayOrder', 'integer'),
      same('role', 'text')
    ]
  },
  {
    source: 'music_track_artists',
    target: 'music_track_artists',
    columns: [
      col('trackId', 'trackId', 'text'),
      col('artistId', 'artistId', 'text'),
      col('displayOrder', 'displayOrder', 'integer'),
      same('role', 'text')
    ]
  },
  {
    source: 'music_playlist_tracks',
    target: 'music_playlist_tracks',
    columns: [
      col('playlistId', 'playlistId', 'text'),
      col('trackId', 'trackId', 'text'),
      same('position', 'integer'),
      col('addedAt', 'addedAt', 'timestamp')
    ]
  },
  {
    source: 'music_entity_links',
    target: 'music_entity_links',
    columns: [
      same('id', 'text'),
      col('entityType', 'entity_type', 'text'),
      col('entityId', 'entityId', 'text'),
      same('platform', 'text'),
      same('url', 'text'),
      same('status', 'text'),
      col('scrapedAt', 'scrapedAt', 'timestamp'),
      col('verifiedAt', 'verifiedAt', 'timestamp'),
      col('verifiedBy', 'verifiedBy', 'text'),
      same('metadata', 'json'),
      col('createdAt', 'createdAt', 'timestamp'),
      col('updatedAt', 'updatedAt', 'timestamp')
    ]
  },
  {
    source: 'releases',
    target: 'releases',
    columns: [
      same('id', 'text'),
      same('title', 'text'),
      same('description', 'text'),
      col('thumbnailUrl', 'thumbnailUrl', 'text'),
      col('bannerImageUrl', 'bannerImageUrl', 'text'),
      same('slug', 'text'),
      col('createdAt', 'createdAt', 'timestamp'),
      col('updatedAt', 'updatedAt', 'timestamp'),
      col('draft', 'draft', 'boolean'),
      same('content', 'text'),
      col('labelId', 'labelId', 'text'),
      col('releaseDate', 'releaseDate', 'timestamp'),
      col('streamingLinks', 'streamingLinks', 'json')
    ]
  },
  {
    source: 'external_accounts',
    target: 'external_accounts',
    columns: [
      same('id', 'text'),
      col('user_id', 'user_id', 'text'),
      same('provider', 'text'),
      col('provider_account_id', 'provider_account_id', 'text'),
      same('handle', 'text'),
      col('display_name', 'display_name', 'text'),
      col('avatar_url', 'avatar_url', 'text'),
      same('issuer', 'text'),
      col('service_endpoint', 'service_endpoint', 'text'),
      same('status', 'text'),
      col('last_error_category', 'last_error_category', 'text'),
      col('last_successful_sync_at', 'last_successful_sync_at', 'timestamp'),
      col('created_at', 'created_at', 'timestamp'),
      col('updated_at', 'updated_at', 'timestamp')
    ]
  },
  {
    source: 'external_account_sessions',
    target: 'external_account_sessions',
    columns: [
      same('id', 'text'),
      col('external_account_id', 'external_account_id', 'text'),
      col('app_password', 'app_password', 'json'),
      same('session', 'json'),
      col('updated_at', 'updated_at', 'timestamp')
    ]
  },
  {
    source: 'bluesky_sync_states',
    target: 'bluesky_sync_states',
    columns: [
      col('external_account_id', 'external_account_id', 'text'),
      same('cursor', 'text'),
      col('lookback_days', 'lookback_days', 'integer'),
      same('scheduled', 'boolean'),
      col('consecutive_failures', 'consecutive_failures', 'integer'),
      col('next_eligible_at', 'next_eligible_at', 'timestamp'),
      col('last_attempted_at', 'last_attempted_at', 'timestamp'),
      col('last_started_at', 'last_started_at', 'timestamp'),
      col('updated_at', 'updated_at', 'timestamp')
    ]
  },
  {
    source: 'bluesky_sync_runs',
    target: 'bluesky_sync_runs',
    columns: [
      same('id', 'text'),
      col('external_account_id', 'external_account_id', 'text'),
      same('status', 'text'),
      same('discovered', 'integer'),
      same('qualifying', 'integer'),
      same('created', 'integer'),
      col('already_imported', 'already_imported', 'integer'),
      same('skipped', 'integer'),
      same('unresolved', 'integer'),
      same('conflicted', 'integer'),
      same('failed', 'integer'),
      col('page_count', 'page_count', 'integer'),
      col('error_category', 'error_category', 'text'),
      col('started_at', 'started_at', 'timestamp'),
      col('finished_at', 'finished_at', 'timestamp')
    ]
  },
  {
    source: 'bluesky_post_sources',
    target: 'bluesky_post_sources',
    columns: [
      same('id', 'text'),
      col('external_account_id', 'external_account_id', 'text'),
      col('post_id', 'post_id', 'text'),
      col('author_did', 'author_did', 'text'),
      col('author_handle', 'author_handle', 'text'),
      col('at_uri', 'at_uri', 'text'),
      same('cid', 'text'),
      col('public_url', 'public_url', 'text'),
      col('source_created_at', 'source_created_at', 'timestamp'),
      col('source_status', 'source_status', 'text'),
      col('source_fingerprint', 'source_fingerprint', 'text'),
      col('source_text', 'source_text', 'text'),
      col('source_facets', 'source_facets', 'json'),
      col('source_embeds', 'source_embeds', 'json'),
      col('locally_edited', 'locally_edited', 'boolean'),
      col('last_seen_at', 'last_seen_at', 'timestamp'),
      col('last_error', 'last_error', 'text'),
      col('created_at', 'created_at', 'timestamp'),
      col('updated_at', 'updated_at', 'timestamp')
    ]
  },
  {
    source: 'favorites',
    target: 'favorites',
    columns: [
      same('id', 'text'),
      col('user_id', 'user_id', 'text'),
      col('audio_id', 'audio_id', 'text'),
      col('show_id', 'show_id', 'text'),
      col('created_at', 'created_at', 'timestamp')
    ]
  },
  {
    source: 'navigation_sessions',
    target: 'navigation_sessions',
    columns: [
      same('id', 'text'),
      col('userId', 'userId', 'text'),
      col('deviceToken', 'deviceToken', 'text'),
      same('cursor', 'integer'),
      col('lastIntentToken', 'lastIntentToken', 'text'),
      col('createdAt', 'createdAt', 'timestamp'),
      col('updatedAt', 'updatedAt', 'timestamp')
    ]
  },
  {
    source: 'navigation_seen_posts',
    target: 'navigation_seen_posts',
    columns: [col('sessionId', 'sessionId', 'text'), same('slug', 'text')]
  },
  {
    source: 'navigation_trail_entries',
    target: 'navigation_trail_entries',
    columns: [
      same('id', 'text'),
      col('sessionId', 'sessionId', 'text'),
      col('postId', 'postId', 'text'),
      same('slug', 'text'),
      same('position', 'integer'),
      col('arrivedBy', 'arrivedBy', 'text'),
      col('visitedAt', 'visitedAt', 'timestamp')
    ]
  },
  {
    source: 'newsletter_subscribers',
    target: 'newsletter_subscribers',
    columns: [
      same('id', 'text'),
      same('email', 'text'),
      same('name', 'text'),
      same('source', 'text'),
      col('userId', 'userId', 'text'),
      col('unsubscribeToken', 'unsubscribeToken', 'text'),
      col('unsubscribedAt', 'unsubscribedAt', 'timestamp'),
      col('createdAt', 'createdAt', 'timestamp'),
      col('updatedAt', 'updatedAt', 'timestamp')
    ]
  },
  {
    source: 'user_email_preferences',
    target: 'user_email_preferences',
    columns: [
      same('id', 'text'),
      col('userId', 'userId', 'text'),
      col('mixReleaseEnabled', 'mixReleaseEnabled', 'boolean'),
      col('promotionalEnabled', 'promotionalEnabled', 'boolean'),
      col('systemEnabled', 'systemEnabled', 'boolean'),
      col('globalUnsubscribe', 'globalUnsubscribe', 'boolean'),
      col('unsubscribeToken', 'unsubscribeToken', 'text'),
      col('createdAt', 'createdAt', 'timestamp'),
      col('updatedAt', 'updatedAt', 'timestamp')
    ]
  },
  {
    source: 'music_reminder',
    target: 'music_reminder',
    columns: [
      same('id', 'text'),
      col('user_id', 'user_id', 'text'),
      col('music_title', 'music_title', 'text'),
      col('artist_name', 'artist_name', 'text'),
      col('music_url', 'music_url', 'text'),
      col('album_cover_url', 'album_cover_url', 'text'),
      col('reminder_date', 'reminder_date', 'timestamp'),
      same('notes', 'text'),
      same('status', 'text'),
      col('is_sent', 'is_sent', 'boolean'),
      col('created_at', 'created_at', 'timestamp'),
      col('updated_at', 'updated_at', 'timestamp')
    ]
  },
  {
    source: 'upload_assets',
    target: 'upload_assets',
    columns: [
      same('id', 'text'),
      col('user_id', 'user_id', 'text'),
      same('key', 'text'),
      same('bucket', 'text'),
      col('asset_type', 'asset_type', 'text'),
      same('status', 'text'),
      col('upload_id', 'upload_id', 'text'),
      col('expected_size', 'expected_size', 'integer'),
      col('attached_to_table', 'attached_to_table', 'text'),
      col('attached_to_id', 'attached_to_id', 'text'),
      col('created_at', 'created_at', 'timestamp'),
      col('updated_at', 'updated_at', 'timestamp'),
      col('expires_at', 'expires_at', 'timestamp')
    ]
  },
  {
    source: 'email_delivery_logs',
    target: 'email_delivery_logs',
    columns: [
      same('id', 'text'),
      col('userId', 'userId', 'text'),
      col('recipientEmail', 'recipientEmail', 'text'),
      col('recipientName', 'recipientName', 'text'),
      col('emailType', 'emailType', 'text'),
      col('templateName', 'templateName', 'text'),
      same('subject', 'text'),
      same('status', 'text'),
      col('sesMessageId', 'provider', 'ses-provider'),
      col('sesMessageId', 'providerMessageId', 'text'),
      same('metadata', 'json'),
      col('errorMessage', 'errorMessage', 'text'),
      col('sentAt', 'sentAt', 'timestamp'),
      col('deliveredAt', 'deliveredAt', 'timestamp'),
      col('bouncedAt', 'bouncedAt', 'timestamp'),
      col('complainedAt', 'complainedAt', 'timestamp'),
      col('createdAt', 'createdAt', 'timestamp'),
      col('updatedAt', 'updatedAt', 'timestamp')
    ]
  }
]

const isoToEpochMs = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Cannot parse timestamp value: ${String(value)}`)
  }
  return date.getTime()
}

const transformValue = (value: unknown, kind: ColumnKind): unknown => {
  switch (kind) {
    case 'text':
    case 'integer':
      return value === undefined ? null : value
    case 'ses-provider':
      return value === null || value === undefined ? null : 'ses'
    case 'timestamp':
      return isoToEpochMs(value)
    case 'boolean':
      if (value === null || value === undefined) return null
      return value ? 1 : 0
    case 'json':
      if (value === null || value === undefined) return null
      return typeof value === 'string' ? value : JSON.stringify(value)
  }
}

const pgConfig = {
  host: process.env.PG_HOST ?? 'localhost',
  port: Number(process.env.PG_PORT ?? 5432),
  user: process.env.PG_USER ?? 'postgres',
  password: process.env.PG_PASSWORD ?? 'postgres',
  database: process.env.PG_DATABASE ?? 'postgres',
  ssl: process.env.PG_SSL === 'true'
}

const persistPath = process.env.D1_PERSIST_PATH ?? './.migration-d1'

const quoteIdentifier = (identifier: string) => `"${identifier}"`

const buildSelectQuery = (table: TableSpec) => {
  const columns = table.columns.map(
    (c) => `${quoteIdentifier(c.source)} as ${quoteIdentifier(c.target)}`
  )
  return `select ${columns.join(', ')} from ${quoteIdentifier(table.source)} order by 1`
}

const buildInsertStatement = (
  db: D1Database,
  target: string,
  columns: ReadonlyArray<string>,
  values: ReadonlyArray<unknown>
) => {
  const placeholders = columns.map(() => '?').join(', ')
  const columnList = columns.map(quoteIdentifier).join(', ')
  const sql = `insert or replace into ${quoteIdentifier(target)} (${columnList}) values (${placeholders})`
  return db.prepare(sql).bind(...values)
}

const BATCH_SIZE = 100

const runBatched = async (db: D1Database, statements: ReadonlyArray<D1PreparedStatement>) => {
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    await db.batch(statements.slice(i, i + BATCH_SIZE))
  }
}

const orderRowsBySelfReferences = (table: TableSpec, rows: ReadonlyArray<Row>) => {
  const selfReferenceColumns = table.selfReferenceColumns
  if (!selfReferenceColumns || selfReferenceColumns.length === 0) return rows

  const pending = new Map<string, Row>()
  for (const row of rows) {
    const id = row.id
    if (typeof id !== 'string') {
      throw new Error(`Expected a string id while ordering ${table.source}`)
    }
    pending.set(id, row)
  }

  const ordered: Row[] = []
  while (pending.size > 0) {
    let progressed = false
    for (const [id, row] of pending) {
      const blocked = selfReferenceColumns.some((column) => {
        const reference = row[column]
        if (reference === null || reference === undefined || reference === id) return false
        if (typeof reference !== 'string') {
          throw new Error(`Expected a string ${column} while ordering ${table.source}`)
        }
        return pending.has(reference)
      })
      if (blocked) continue
      pending.delete(id)
      ordered.push(row)
      progressed = true
    }
    if (!progressed) {
      throw new Error(`Cannot resolve self-referential dependencies in ${table.source}`)
    }
  }

  return ordered
}

const migrateTable = async (
  pg: Client,
  db: D1Database,
  table: TableSpec
): Promise<{ table: string; rowCount: number }> => {
  const result = await pg.query<Row>(buildSelectQuery(table))
  const targetColumns = table.columns.map((c) => c.target)
  const statements = orderRowsBySelfReferences(table, result.rows).map((row) => {
    const values = table.columns.map((c) => transformValue(row[c.target], c.kind))
    return buildInsertStatement(db, table.target, targetColumns, values)
  })
  await runBatched(db, statements)
  console.log(`[migrate] ${table.source} -> ${table.target}: ${result.rows.length} rows`)
  return { table: table.target, rowCount: result.rows.length }
}

const distinct = (values: ReadonlyArray<string>) => [...new Set(values)]

/**
 * Fans array columns out into labels/entity_labels. Position is the source
 * array index, matching the ordering guarantee entity_labels.position exists
 * to preserve.
 */
type LabelRow = { readonly id: string; readonly kind: string; readonly name: string }

const loadExistingLabels = async (db: D1Database) => {
  const result = await db.prepare('select id, kind, name from labels').bind().all<LabelRow>()
  const labelIds = new Map<string, string>()
  for (const row of result.results) {
    labelIds.set(`${row.kind}:${row.name}`, row.id)
  }
  return labelIds
}

/**
 * Re-running the migration must converge, not merely avoid crashing: an
 * entity whose tag array shrank between runs should not leave orphaned
 * entity_labels rows behind. Clearing every entityType this migration owns
 * before re-inserting makes the fan-out idempotent the same way
 * db/labels.ts's replaceEntityLabels is (delete-then-insert per entity).
 */
const clearMigratedEntityLabels = async (db: D1Database) => {
  const entityTypes = distinct(ARRAY_FAN_OUTS.map((fanOut) => fanOut.entityType))
  const statements = entityTypes.map((entityType) =>
    db.prepare('delete from entity_labels where entity_type = ?').bind(entityType)
  )
  await runBatched(db, statements)
}

type ArrayColumnRow = { readonly id: string; readonly values: ReadonlyArray<string> | null }

const migrateArrayFanOuts = async (
  pg: Client,
  db: D1Database
): Promise<{ labelsInserted: number; entityLabelsInserted: number }> => {
  await clearMigratedEntityLabels(db)
  const labelIds = await loadExistingLabels(db)
  const labelStatements: D1PreparedStatement[] = []
  const entityLabelStatements: D1PreparedStatement[] = []

  for (const fanOut of ARRAY_FAN_OUTS) {
    const result = await pg.query<ArrayColumnRow>(
      `select id, ${quoteIdentifier(fanOut.column)} as values from ${quoteIdentifier(fanOut.sourceTable)} order by id`
    )
    for (const row of result.rows) {
      const values = row.values ?? []
      const orderedUnique = distinct(values)
      orderedUnique.forEach((name, position) => {
        const key = `${fanOut.kind}:${name}`
        let labelId = labelIds.get(key)
        if (!labelId) {
          labelId = crypto.randomUUID()
          labelIds.set(key, labelId)
          labelStatements.push(
            buildInsertStatement(db, 'labels', ['id', 'kind', 'name'], [labelId, fanOut.kind, name])
          )
        }
        entityLabelStatements.push(
          buildInsertStatement(
            db,
            'entity_labels',
            ['entity_type', 'entity_id', 'position', 'label_id'],
            [fanOut.entityType, row.id, position, labelId]
          )
        )
      })
    }
  }

  await runBatched(db, labelStatements)
  await runBatched(db, entityLabelStatements)
  console.log(
    `[migrate] labels: ${labelStatements.length} rows, entity_labels: ${entityLabelStatements.length} rows`
  )
  return {
    labelsInserted: labelStatements.length,
    entityLabelsInserted: entityLabelStatements.length
  }
}

const createTargetDatabase = async () => {
  if (process.env.D1_DATABASE_ID) {
    return {
      miniflare: { dispose: async () => {} },
      database: createRemoteD1(remoteD1OptionsFromEnv())
    }
  }

  const miniflare = new Miniflare({
    script: 'export default { fetch() { return new Response() } }',
    modules: true,
    d1Databases: { DB: 'migration-target' },
    resourcePersistencePath: persistPath === ':memory:' ? undefined : persistPath
  })
  const database = await miniflare.getD1Database('DB')
  return { miniflare, database }
}

const migrationsDir = new URL('../drizzle-d1/', import.meta.url)

/** The ordered local D1 migrations required before importing Postgres rows. */
export const d1MigrationFiles = [
  '0000_public_thunderbolt.sql',
  '0001_search_fts.sql',
  '0002_email_provider_receipt.sql'
] as const

const migrationLedgerTable = '__gbfm_local_migration_ledger'

const splitMigrationStatements = (migration: string) =>
  migration
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)

const databaseObjectExists = async (database: D1Database, name: string) => {
  const row = await database
    .prepare('select name from sqlite_master where name = ?')
    .bind(name)
    .first()
  return row !== null && row !== undefined
}

const applyExistingSchemaBaseline = async (database: D1Database) => {
  const applied = await database
    .prepare(`select name from ${migrationLedgerTable} limit 1`)
    .bind()
    .first()
  if (applied) return

  // A deployed target has its migrations applied by the deploy itself, which
  // records them in Cloudflare's own `d1_migrations` ledger. Trust that when
  // it exists: the schema-marker probes below only know about the migrations
  // that existed when they were written, so a newer one would be re-applied
  // against a schema that already has it.
  if (await databaseObjectExists(database, 'd1_migrations')) {
    const deployed = await database
      .prepare('select name from d1_migrations')
      .bind()
      .all<{ name: string }>()
    const names = deployed.results.map((row) => row.name)
    if (names.length > 0) {
      await database.batch(
        names.map((name) =>
          database
            .prepare(`insert or ignore into ${migrationLedgerTable} (name) values (?)`)
            .bind(name)
        )
      )
      console.log(`[migrate] baselined from d1_migrations: ${names.join(', ')}`)
      return
    }
  }

  const knownExistingMigrations: Array<string> = []
  if (await databaseObjectExists(database, 'user')) {
    knownExistingMigrations.push('0000_public_thunderbolt.sql')
  }
  if (await databaseObjectExists(database, 'audio_fts')) {
    knownExistingMigrations.push('0001_search_fts.sql')
  }
  if (knownExistingMigrations.length === 0) return

  await database.batch(
    knownExistingMigrations.map((name) =>
      database.prepare(`insert or ignore into ${migrationLedgerTable} (name) values (?)`).bind(name)
    )
  )
  console.log(
    `[migrate] baselined existing target migrations: ${knownExistingMigrations.join(', ')}`
  )
}

/**
 * Applies missing D1 migrations with a local ledger.
 *
 * Existing targets created before the ledger are baselined from durable schema
 * markers, so a persisted 0000/0001 target receives newly added migrations.
 */
export const applyMigrations = async (database: D1Database) => {
  await database
    .prepare(`create table if not exists ${migrationLedgerTable} (name text primary key)`)
    .bind()
    .run()
  await applyExistingSchemaBaseline(database)

  const rows = await database
    .prepare(`select name from ${migrationLedgerTable}`)
    .bind()
    .all<{ name: string }>()
  const applied = new Set(rows.results.map((row) => row.name))

  for (const file of d1MigrationFiles) {
    if (applied.has(file)) continue
    const sqlText = await readFile(new URL(file, migrationsDir), 'utf8')
    const statements = splitMigrationStatements(sqlText).map((statement) =>
      database.prepare(statement).bind()
    )
    statements.push(
      database.prepare(`insert into ${migrationLedgerTable} (name) values (?)`).bind(file)
    )
    await database.batch(statements)
    applied.add(file)
  }
}

const main = async () => {
  console.log('[migrate] connecting to source Postgres', {
    host: pgConfig.host,
    port: pgConfig.port,
    database: pgConfig.database
  })
  const pg = new Client(pgConfig)
  await pg.connect()

  console.log('[migrate] preparing target D1', { persistPath })
  const { miniflare, database } = await createTargetDatabase()
  await applyMigrations(database)

  const results: Array<{ table: string; rowCount: number }> = []
  try {
    for (const table of TABLES) {
      results.push(await migrateTable(pg, database, table))
    }
    const fanOutResult = await migrateArrayFanOuts(pg, database)
    results.push({ table: 'labels', rowCount: fanOutResult.labelsInserted })
    results.push({ table: 'entity_labels', rowCount: fanOutResult.entityLabelsInserted })
  } finally {
    await pg.end()
  }

  console.log('[migrate] done')
  console.table(results)

  await miniflare.dispose()
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('[migrate] failed', error)
    process.exit(1)
  })
}

export {
  ARRAY_FAN_OUTS,
  TABLES,
  transformValue,
  isoToEpochMs,
  buildSelectQuery,
  orderRowsBySelfReferences,
  type TableSpec,
  type ColumnSpec,
  type ArrayFanOut
}
