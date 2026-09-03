# Canonical Music Identity

Status: Draft for review

## Summary

GBFM should resolve each external music source to one internal music entity. Once GBFM has resolved a Spotify album, track, or playlist, later uses of the same source must return the stored entity without calling Spotify, Odesli, MusicBrainz, or another provider.

The current editorial and tweet path mostly does this, but the guarantee lives inside one scrape workflow. Other import, enrichment, and manual-link paths use different identity rules. The current lookup also falls back to scanning and normalizing every link of an entity type.

This design adds an indexed source-identity registry and puts every URL-driven music workflow behind one deep module. Rendering remains a read-only operation over GBFM entity IDs. Explicit administrator refresh remains the only path that intentionally calls providers again for a resolved identity.

## Goals

1. Return the same GBFM entity for every known spelling of the same provider identity.
2. Perform no provider request when a resolved source identity already exists.
3. Prevent concurrent Workers from creating duplicate entities for the same source.
4. Give editorial, tweets, replies, Bluesky imports, Spotify imports, enrichment, and manual links one identity rule.
5. Keep explicit refresh separate from ordinary resolution.
6. Replace application-side link scans with indexed D1 lookups.
7. Detect identity collisions without silently merging or overwriting entities.
8. Roll out without downtime and without rewriting existing content.

## Non-goals

- Automatically merge existing duplicate entities. Track that work separately in [#316](https://github.com/guidefari/gbfm/issues/316).
- Use an external provider ID as a GBFM entity ID.
- Match playlists across platforms.
- Scrape while rendering published content.
- Remove existing routes or change their successful response bodies during the first rollout.

## Terms

**Music entity**: A GBFM artist, album, track, or playlist with a GBFM ID.

**Source identity**: A stable external identity such as `spotify:album:1BIXNamH3zTLBSb3my28k6`.

**Source alias**: A normalized URL that points to a source identity.

**Resolution**: Find or create the GBFM entity for a source identity.

**Refresh**: Call providers again for an existing GBFM entity and update its metadata or links.

**Identity collision**: One source identity points to more than one GBFM entity, or a caller tries to attach an owned identity to another entity.

## Current system

### Main resolve path

`apps/server/src/services/music-entity/scrape.service.ts` contains `scrapeAndCreateEntityEffect`.

For a URL, it currently:

1. Calls `canonicalizeMusicSourceLink` from `apps/server/src/services/music-source-url.ts`.
2. Looks for an exact `music_entity_links.url` match for the inferred entity type.
3. For Spotify, YouTube, and Deezer misses, loads all links of that entity type and canonicalizes them in application code.
4. Returns the stored entity when it finds a valid match.
5. Otherwise claims `(entity_type, canonical_url)` in `music_entity_resolution_claims`.
6. Lets only the claim owner scrape and create the entity.
7. Stores links and completes the claim.

This path already avoids repeat scraping for known canonical URLs. Tests in `apps/server/src/services/music-entity/scrape.service.d1.test.ts` cover exact reuse, Spotify query normalization, and concurrent claims.

### Rendering

`<MusicEntity type="..." id="..." />` rendering does not scrape. `apps/www/src/components/tweet-export/use-music-entity.ts` performs ordinary GET requests for the stored entity and verified links. React Query caches those reads.

Editorial currently sends `POST /api/music/resolve` on each paste, even when the same URL was resolved earlier. The backend should return a known entity without scraping, but the editor still shows a pending state while it asks the server.

### Separate identity paths

The following callers do not share the full canonical resolution rule:

- `apps/server/src/services/spotify-import-resolver.service.ts` uses exact Spotify URLs and separate serialization.
- `apps/server/src/durable-objects/spotify-import-resolver.do.ts` coordinates Spotify imports by raw URL.
- `apps/server/src/services/bluesky-archive.service.ts` scrapes before calling the main resolve path, which can scrape new entities twice and known entities once.
- `apps/server/src/services/music-entity/playlist-tracks.service.ts` can enrich reused tracks through fresh provider calls.
- `apps/server/src/services/music-entity/link.service.ts` can attach links without checking global source ownership.
- Explicit link rescrape calls `refreshEntityLinksEffect`. This is correct and must remain distinct.

## Design

### Deep module

Add one `CanonicalMusicIdentity` module at:

```text
apps/server/src/services/canonical-music-identity/
  index.ts
  music-source.ts
  repository.ts
  errors.ts
```

Its public interface expresses caller intent and hides canonicalization, indexed lookup, claims, provider calls, entity creation, identity registration, and collision handling.

```ts
type ResolutionOrigin =
  | 'editorial'
  | 'tweet'
  | 'reply'
  | 'bluesky'
  | 'spotify_import'
  | 'playlist_enrichment'
  | 'manual'

type ResolveMusicSource = {
  readonly url: string
  readonly expectedType?: 'artist' | 'album' | 'track' | 'playlist'
  readonly origin: ResolutionOrigin
}

type ImportProviderMusicEntity = {
  readonly snapshot: ProviderMusicSnapshot
  readonly origin: Extract<ResolutionOrigin, 'spotify_import' | 'playlist_enrichment'>
}

type AttachMusicSourceLink = {
  readonly entityType: 'artist' | 'album' | 'track' | 'playlist'
  readonly entityId: string
  readonly url: string
  readonly origin: 'manual'
}

type RefreshMusicEntity = {
  readonly entityType: 'artist' | 'album' | 'track' | 'playlist'
  readonly entityId: string
  readonly actorId: string
}

interface CanonicalMusicIdentity {
  readonly resolveSource: (
    input: ResolveMusicSource
  ) => Effect.Effect<ResolvedMusicEntity, MusicIdentityError>

  readonly importProviderEntity: (
    input: ImportProviderMusicEntity
  ) => Effect.Effect<ResolvedMusicEntity, MusicIdentityError>

  readonly attachLink: (
    input: AttachMusicSourceLink
  ) => Effect.Effect<SelectMusicEntityLink, MusicIdentityError>

  readonly refreshEntity: (
    input: RefreshMusicEntity
  ) => Effect.Effect<RefreshedMusicEntity, MusicIdentityError>
}
```

The interface has four operations because resolution, trusted provider import, manual attachment, and explicit refresh have different invariants. Callers must not call the scraper or manage claims themselves.

`MusicLinkScraperService` remains the outbound provider adapter. D1 remains the local substitute for tests through Miniflare.

### Source keys

Known providers use stable IDs:

```text
spotify:track:4iV5W9uYEdYUVa79Axb7Rh
spotify:album:1BIXNamH3zTLBSb3my28k6
spotify:playlist:37i9dQZF1DX...
deezer:album:302127
youtube:video:dQw4w9WgXcQ
```

Unknown public HTTPS sources use:

```text
url:sha256:<digest-of-normalized-url>
```

Rules:

1. Parse known provider hosts by exact host or valid subdomain.
2. Reject credentials, control characters, oversized values, private addresses, loopback addresses, link-local addresses, and metadata-service destinations.
3. Strip known tracking parameters.
4. Preserve and sort unknown parameters because they may change resource identity.
5. Remove fragments.
6. Make canonicalization idempotent.
7. Reject a provider type that conflicts with `expectedType` before scraping.
8. Keep playlists exact to one provider identity.

### D1 schema

Add `music_source_identities`:

| Column | Type | Rule |
|---|---|---|
| `source_key` | text | Primary key |
| `platform` | text | Not null, references music platforms |
| `source_entity_type` | text | Not null |
| `external_id` | text | Nullable for generic URLs |
| `canonical_url` | text | Not null |
| `state` | text | `resolving` or `resolved` |
| `entity_type` | text | Set only when resolved |
| `entity_id` | text | Set only when resolved |
| `owner_token` | text | Set only while resolving |
| `lease_expires_at` | integer | Set only while resolving |
| `resolved_at` | integer | Nullable |
| `last_scraped_at` | integer | Nullable |
| `created_at` | integer | Not null |
| `updated_at` | integer | Not null |

Indexes and constraints:

- Primary key on `source_key`.
- Unique index on `canonical_url`.
- Partial unique index on `(platform, source_entity_type, external_id)` where `external_id IS NOT NULL`.
- Index on `(entity_type, entity_id)`.
- Index on `(state, lease_expires_at)`.
- A resolving row has an owner and lease but no entity.
- A resolved row has an entity and no owner or lease.

Add `music_source_aliases`:

| Column | Type | Rule |
|---|---|---|
| `normalized_url` | text | Primary key |
| `source_key` | text | Not null, references source identities |
| `first_seen_at` | integer | Not null |
| `last_seen_at` | integer | Not null |

Add an index on `source_key`.

Add `music_source_identity_conflicts`:

| Column | Purpose |
|---|---|
| `id` | Conflict ID |
| `source_key` | Conflicting source identity |
| `incumbent_entity_type`, `incumbent_entity_id` | Current owner |
| `candidate_entity_type`, `candidate_entity_id` | Rejected owner |
| `reason` | Typed reason |
| `status` | `open`, `resolved`, or `ignored` |
| `detected_at`, `resolved_at` | Audit times |

Add a unique index that prevents duplicate open reports for the same source and entity pair.

`music_entity_links` remains the rendering and review projection. It no longer acts as the identity authority.

D1 cannot enforce foreign keys from one polymorphic `entity_id` to four entity tables. The module must verify entity existence, remove identities during entity deletion, and repair or report orphan mappings during reads.

### Lookup and resolution

`resolveSource` performs these steps:

1. Parse the input into a source key and normalized alias.
2. Look up `music_source_aliases.normalized_url` and `music_source_identities.source_key` through indexes.
3. If either maps to a valid resolved entity, update `last_seen_at` and return it without calling a provider.
4. If no resolved identity exists, atomically insert a resolving row or reclaim an expired lease.
5. If another Worker owns a live lease, poll with bounded backoff and then return `MusicIdentityBusy { retryAfterMs }`.
6. Let the lease owner call the provider adapter.
7. Derive source keys for trusted links returned by the provider.
8. Check those source keys for an existing owner.
9. If they all point to one existing entity, attach the input source identity to that entity and return it.
10. If they point to several entities, record a conflict and return `MusicIdentityConflict`.
11. If none exists, create one GBFM entity.
12. Store the entity, links, aliases, and resolved identities with owner-token guards.
13. Return the entity and links.

This allows a YouTube resolution to find an existing Spotify-backed entity after provider discovery, while refusing an unsafe automatic merge when discovered links disagree.

### Concurrency and fencing

- A source key may have one live lease.
- Lease ownership uses a random owner token and expiry time.
- Renewal, completion, and release include the owner token in their predicates.
- No database transaction stays open during a provider request.
- Final D1 writes use one atomic batch.
- Entity and link inserts use guarded `INSERT ... SELECT ... WHERE EXISTS (...)` statements that require the current owner token.
- The final identity update uses the same owner token.
- A lost owner creates no entity or link rows and reloads the winner.
- Discovered source keys are claimed in sorted order to avoid conflicting acquisition order.
- An expired lease may be reclaimed.
- Worker termination leaves a lease that expires naturally.

### Explicit refresh

`refreshEntity` always calls a provider and never creates another GBFM entity.

It:

1. Loads the existing entity and its verified exact-source link.
2. Calls the provider adapter.
3. Checks all discovered identities for ownership conflicts.
4. Updates metadata, links, aliases, and `last_scraped_at`.
5. Keeps the old entity and links intact if the provider call or commit fails.

Ordinary resolution never invokes this operation. An administrator action must request it explicitly.

### Client behavior

Keep the current routes and success bodies during rollout:

- `POST /api/music/resolve`
- `POST /api/music/:entityType/scrape`
- `POST /api/music/:entityType/:entityId/links/rescrape`
- Existing Spotify import routes
- Existing entity-link routes

Return:

- `200` for a resolved identity, with no provider request on a hit.
- `400` for malformed, unsupported, or type-mismatched input.
- `409` for an identity collision.
- `503` plus `Retry-After` for a live lease or provider outage.

Frontend callers should use one React Query definition keyed by the canonical source key. Editorial, tweets, and replies should share it. A browser cache hit can skip the resolution request, but the server remains authoritative.

Rendering must continue to use `(entityType, entityId)` and must never call a resolution route.

## Caller migration

### Editorial, tweets, and replies

Keep `POST /api/music/resolve`, but route it through `CanonicalMusicIdentity.resolveSource`. Replace the editorial imperative cache and tweet raw-URL cache with one canonical query definition.

### Bluesky imports

Remove the preliminary direct call to `MusicLinkScraperService.scrape`. Call `resolveSource` once and use the returned entity type and ID.

### Spotify imports

Use `importProviderEntity` for trusted playlist and track snapshots. Remove exact raw-URL lookup from `spotify-import-resolver.service.ts`.

After all Spotify import paths use the D1 identity registry, remove `SpotifyImportResolverDurableObject`, its binding, raw-URL naming, and in-process serialization. D1 uniqueness becomes the cross-isolate authority.

### Playlist enrichment

Enter through `importProviderEntity`. Skip provider work when the imported snapshot and enrichment state are already current. Explicit playlist synchronization may call `refreshEntity`.

### Manual links

Route `addEntityLink` through `attachLink`. Reject source ownership collisions with `409`; never overwrite the incumbent mapping.

### Compatibility adapters

Make `scrapeAndCreateEntityEffect` delegate to `resolveSource` while callers migrate, then remove it. Make `refreshEntityLinksEffect` delegate to `refreshEntity`.

## Migration and backfill

This is a production database change. Implementation requires explicit approval before applying any migration or running a backfill.

Follow `apps/server/src/db/AGENTS.md`:

1. Hand-write `apps/server/drizzle-d1/0006_canonical_music_identity.sql`.
2. Add entry `6` to `apps/server/drizzle-d1/meta/_journal.json`.
3. Add the filename to `d1MigrationFiles` in `apps/server/src/test/migrate-d1.ts`.
4. Update `apps/server/src/db/music-entity.schema.ts`.
5. Replay migrations against Miniflare. Do not run `drizzle-kit generate`, `drizzle push`, or a production migration during development.

The SQL migration only adds tables and indexes. It performs no URL parsing, provider calls, entity merges, or destructive updates.

### Backfill

Use a resumable application command after the additive schema deploys:

1. Read `music_entity_links` in stable `(created_at, id)` pages.
2. Verify each referenced GBFM entity exists.
3. Parse each URL with the same production source parser.
4. Group rows by source key.
5. Choose an incumbent in this order:
   - verified link over unverified link;
   - valid entity over orphaned entity;
   - earliest `verified_at`;
   - earliest `scraped_at`;
   - earliest `created_at`;
   - lowest link ID.
6. Insert the incumbent identity and safe aliases.
7. Record every other mapping as a conflict.
8. Import completed legacy claims only when they agree with the incumbent.
9. Ignore unresolved legacy leases.
10. Save the page cursor and counts after every batch.

The backfill must be safe to stop, resume, and rerun. It must not merge or delete duplicate entities. Existing posts, editorial MDX, playlists, and links continue to reference their current entity IDs until a later manual conflict-resolution tool repoints them.

## Rollout

1. **Baseline:** Add cache-hit, scrape-origin, collision, and latency telemetry to the current path.
2. **Additive schema:** Deploy the three new tables and indexes. Keep existing reads and writes.
3. **Dual write:** Write new identities and legacy claims. Continue reading from the legacy path.
4. **Backfill:** Run resumable batches and inspect conflicts and orphan mappings.
5. **Shadow read:** Compare new indexed decisions with legacy lookup decisions without changing responses.
6. **Read cutover:** Read the new registry first, then use the old lookup as a repair fallback.
7. **Caller cutover:** Migrate Bluesky, Spotify import, enrichment, manual links, editorial, tweets, and replies.
8. **Enforcement:** Reject unindexed source ownership collisions.
9. **Cleanup:** Stop legacy dual writes. Remove legacy claims and Spotify import coordination in a later release.

Before cleanup, a feature flag may restore legacy reads while new writes remain additive. Do not roll back by deleting populated identity tables.

Advance only when:

- Backfill lag is zero.
- Operators have reviewed all collisions.
- Shadow reads agree with legacy behavior.
- Provider requests do not increase.
- Resolution errors and latency stay within the baseline.

## Observability

Add Effect spans at the module interface:

- `musicIdentity.resolveSource`
- `musicIdentity.lookup`
- `musicIdentity.claim`
- `musicIdentity.scrape`
- `musicIdentity.commit`
- `musicIdentity.attachLink`
- `musicIdentity.refreshEntity`
- `musicIdentity.backfillBatch`

Record:

- origin;
- platform;
- source entity type;
- hashed source key;
- result: `hit`, `miss`, `wait`, or `reclaimed`;
- entity type and ID;
- claim age and retry count;
- provider;
- error tag;
- link and alias counts;
- explicit refresh flag.

Do not record raw source URLs, query parameters, provider payloads, owner tokens, credentials, or arbitrary thrown values.

Track or derive:

- resolution requests by origin;
- identity hit ratio;
- provider request count;
- waits and lease reclaims;
- resolution latency;
- collisions and orphan mappings;
- stale resolving rows;
- backfill scanned, resolved, conflicted, and invalid counts;
- explicit refresh success and failure counts.

The current local Cloudflare Worker does not export traces to the local Tempo stack. The implementation plan must include a verified local trace path or state that local verification uses Sentry and Worker logs.

## Failure handling

| Failure | Result |
|---|---|
| Provider timeout | Release only the caller-owned lease and return retryable `503` |
| Worker termination | Lease expires and another Worker may reclaim it |
| Lost lease | Guarded commit writes nothing; reload the winner |
| Alias collision | Keep incumbent, record conflict, return `409` |
| Type mismatch | Reject before scraping |
| Entity deleted | Remove mappings during deletion; repair or report an orphan on read |
| Backfill interruption | Resume from the last stored cursor |
| Refresh failure | Keep the current entity, links, and identities |
| Lost HTTP response | Client retry returns the indexed entity without scraping |

## Security

- Accept public HTTPS source URLs only.
- Match known provider hosts exactly.
- Revalidate every redirect before fetching.
- Block private, loopback, link-local, and metadata-service destinations.
- Bound URL and external-ID length.
- Keep provider secrets in redacted configuration.
- Require the existing administrator permissions for create, import, manual attachment, conflict resolution, and refresh.
- Rate-limit costly misses by actor and source key.
- Do not expose owner tokens, leases, or conflict details in public responses.

## Testing

### Source parser tests

- Known URL variants produce the same source key.
- Canonicalization is idempotent.
- Tracking parameters do not affect identity.
- Unknown parameters follow the documented rule.
- Lookalike hosts and private destinations fail.
- Provider type mismatches fail.

### D1 tests

Use real Miniflare D1 migrations and recording provider adapters:

- A known identity returns the same entity with zero provider calls.
- Same-source concurrent requests call the provider once.
- Equivalent Spotify, Deezer, and YouTube variants share one identity.
- An expired lease can be reclaimed.
- A lost owner cannot commit entity or link rows.
- A retry after a lost response returns the first entity.
- Cross-platform discovery reuses one existing entity.
- Conflicting discovered identities create a conflict and do not merge.
- Manual link attachment rejects an owned identity.
- Entity deletion removes identities and aliases.
- Backfill winner selection is stable, resumable, and idempotent.
- Migrations replay from `0000` through `0006`.

### Module tests

Test through the `CanonicalMusicIdentity` interface:

- Editorial, tweet, reply, Bluesky, and Spotify callers converge on one entity.
- Provider failures release claims.
- Trusted Spotify snapshots do not trigger a second provider read.
- Existing enrichment is skipped.
- Explicit refresh always calls the provider and never changes the GBFM entity ID.

### HTTP and browser tests

- Existing success bodies remain compatible.
- Busy resolution returns `503` with `Retry-After`.
- Collision returns `409`.
- Editorial repeated paste uses the browser cache, then the same backend entity after reload.
- Published rendering performs only internal GET requests.
- A failed refresh leaves an existing card visible.

## Acceptance criteria

- Every URL-driven entity creation or attachment path crosses `CanonicalMusicIdentity`.
- A repeated known source returns the same entity with zero provider requests.
- Known URL variants share one indexed identity.
- There is no application-side scan of all `music_entity_links` for identity lookup.
- Same-source concurrent requests call the provider once.
- Bluesky and Spotify imports do not run redundant scrapes.
- Manual links cannot steal a source identity.
- Identity collisions are recorded and never silently merged.
- Explicit refresh always calls a provider for the existing entity.
- Rendering never calls a resolution or scrape route.
- The backfill is resumable and makes no automatic destructive changes.
- The rollout requires no downtime.
- All D1 migrations replay in Miniflare and the full server test suite passes.

## Rejected alternatives

### Add a unique URL index to `music_entity_links`

A URL is an alias, not the stable provider identity. URL variants would remain distinct, and the table permits only one link per platform per entity.

### Keep extending `music_entity_resolution_claims`

The table mixes permanent identity, URL spelling, and temporary coordination. It cannot represent many aliases cleanly.

### Use the Spotify import Durable Object for all resolution

It only understands Spotify raw URLs. D1 still needs a source-of-truth uniqueness rule for imports, backfills, and other providers.

### Use MusicBrainz IDs as GBFM IDs

MusicBrainz coverage is incomplete and does not cover playlists. Provider identities must remain indexed even when no MusicBrainz identity exists.

### Automatically merge collisions

References span posts, editorial content, playlists, and links. An automatic merge can corrupt valid relationships and is hard to reverse.

## Open decisions

1. Should generic URLs with unknown query parameters enter the durable identity registry? Recommended: yes, with sorted unknown parameters included in the digest.
2. Should Spotify short links enter the first release? Recommended: accept them only after a safe redirect resolves to a direct Spotify identity.
3. Should artists enter the first caller cutover? Recommended: support them in schema and parsing, then cut them over after albums, tracks, and playlists.
4. How long should typed negative results stay cached? Recommended: a short cache separate from resolved identity rows.
5. What conflict-resolution tool should follow the reporting phase? Recommended: defer merge tooling until the backfill reveals real collision shapes, then complete [#316](https://github.com/guidefari/gbfm/issues/316).
6. Should explicit refresh require transport idempotency keys? Recommended: optional while synchronous, required if moved to a queue.
7. Should the Spotify import Durable Object remain for load shedding after cutover? Recommended: remove it unless production measurements show D1 contention.
