# Canonical Music Identity Closeout

Status: Completed by [PR #321, refactor(music): complete canonical identity flow](https://github.com/guidefari/gbfm/pull/321) (merged 2026-09-06). Archived as the design record, not an active implementation plan.

The production legacy repair fallback was deliberately retained in that PR. Its removal remains a separate decision gated on production audit evidence; see [Legacy Repair-Fallback Gate](#legacy-repair-fallback-gate). The Bluesky references below describe the system at the time of the closeout and do not supersede the decision to [remove the integration](https://github.com/guidefari/gbfm/issues/345).

## Summary

Close the canonical music identity feature by making its existing deep module the only implementation of URL resolution and refresh, moving music artwork delivery behind its seam, and making resolved music entity variants authoritative in the shared HTTP interface.

This work preserves existing routes and successful response bodies. It does not change the D1 schema or production data.

The closeout has three outcomes:

1. `scrape.service.ts` retains metadata-only scraping and loses its superseded URL identity, claim, and refresh implementation.
2. `CanonicalMusicIdentity` returns a persisted music entity whose artwork field is authoritative. Callers stop copying artwork, switching on entity type, persisting image fields, and reconstructing results.
3. `packages/api/src/music.ts` defines correlated artist, album, track, and playlist response variants. Server and web modules stop compensating for `Record<string, unknown>`.

## Context / Current State

The feature described in `docs/canonical-music-identity-tech-spec.md` is substantially implemented:

- `CanonicalMusicIdentity` owns source identity parsing, source alias lookup, claims, collision handling, URL resolution, trusted imports, attachment, release, enrichment, and refresh.
- Editorial, tweet, reply, Bluesky, Spotify import, playlist enrichment, and manual URL paths reach that module.
- D1 identity tables and maintenance tooling exist.
- Canonical behavior is tested through the module interface with Miniflare D1.

Three areas remain open.

### Duplicate URL and refresh implementation

`MusicEntityService.scrapeAndCreateEntity` sends URL input to `CanonicalMusicIdentity.resolveSource`, and `MusicEntityService.refreshEntityLinks` sends refresh input to `CanonicalMusicIdentity.refreshEntity`.

Despite that production routing, `apps/server/src/services/music-entity/scrape.service.ts` still implements:

- URL normalization and lookup;
- legacy claim ownership, waiting, renewal, completion, and release;
- URL-driven entity creation;
- source link insertion;
- refresh source selection and metadata merge;
- playlist refresh replacement.

`apps/server/src/services/music-entity/scrape.service.d1.test.ts` still gives these superseded paths substantial direct coverage. The deletion test says this implementation is waste: deleting it does not spread current production complexity into callers because canonical music identity already owns it.

### Artwork policy leaks across callers

Artwork behavior currently spans:

- `apps/server/src/http/music.handlers.ts` for interactive resolution;
- `apps/server/src/services/music-entity/playlist-tracks.service.ts` for playlist import, track enrichment, and playlist refresh;
- `apps/server/src/services/music-cover-image.service.ts` for URL approval, fetch, response checks, bounded reads, and S3 upload;
- entity-specific update operations for `imageUrl` and `coverImageUrl`.

Callers must know the candidate artwork field, strict versus best-effort failure policy, S3 ordering, entity-specific persistence field, and how to reconstruct the returned music entity. Locality is poor and tests stop at the copy helper or individual caller.

### Shallow shared response interface

`ResolvedMusicEntityResponse.entity` and `ScrapeEntityLinksResponse.entity` are `Schema.Record(Schema.String, Schema.Unknown)`.

That forces:

- `music.handlers.ts` to serialize unknown Drizzle row shapes with `toJsonEntity`;
- `apps/www/src/lib/music-entity-resolution.ts` to define a second response schema;
- callers to rely on fields the shared interface does not guarantee;
- internal result types to permit mismatched `entityType` and `entity` combinations.

The shared module is shallow because callers carry almost as much shape knowledge as its implementation.

### Rollout fallback remains a separate decision

`CanonicalMusicIdentity.resolveSource` still calls `legacyCandidates` and may adopt a matching legacy link when the indexed registry misses. The original rollout plan calls this a repair fallback and allows its removal only after backfill, conflict review, and shadow-read gates pass.

No checked-in evidence proves those production gates have passed. This spec therefore does not silently remove the fallback. It defines a closeout gate that can authorize removal with evidence.

## Goals

1. Make canonical music identity the only URL resolution and refresh implementation.
2. Preserve metadata-only scraping without pretending text metadata is a source identity.
3. Concentrate artwork selection, delivery, persistence, and result consistency behind the canonical identity seam.
4. Correlate music entity type and entity shape in internal and HTTP interfaces.
5. Preserve all existing routes, successful response field names, and status mappings.
6. Test changed behavior through production interfaces and real seams.
7. Delete tests that verify superseded implementation details.
8. Decide legacy repair-fallback removal from rollout evidence, not assumption.

## Non-Goals

- D1 schema changes, migrations, table drops, or production data updates.
- Automatic music entity merges or identity collision resolution.
- New artwork object keys, content-addressed artwork, or CDN behavior changes.
- New provider integrations.
- Changes to rendering, editor embed syntax, or published content.
- Changes to authorization requirements.
- A redesign of unrelated music entity CRUD or label behavior.
- Removing the existing identity maintenance command.
- Introducing a new public artwork module interface when only canonical music identity would call it.

## Invariants

### Source identity

1. Every URL-driven creation or attachment path crosses `CanonicalMusicIdentity`.
2. A known source identity returns the same music entity without a provider request.
3. Equivalent source aliases converge on one source identity.
4. Identity collision never overwrites the incumbent music entity.
5. Resolution claims remain fenced by owner token.
6. No D1 transaction or batch stays open during provider or artwork network work.
7. Refresh never creates a new music entity ID.
8. Metadata-only scraping does not create a source identity without a parsed exact source.

### Artwork

1. A successful result reports the artwork field currently persisted for the music entity.
2. Artist artwork uses `imageUrl`; album, track, and playlist artwork use `coverImageUrl`.
3. Upload completes before a public CDN URL is persisted.
4. A failed upload never leaves D1 pointing at an unwritten object.
5. URL approval, redirect approval, content type, size, and empty-body rules remain unchanged.
6. Strict and best-effort behavior remain explicit and testable.
7. The existing deterministic object key and public URL format remain unchanged.
8. Artwork work does not weaken source identity claim fencing.

### HTTP interface

1. Existing route paths and authorization remain unchanged.
2. Successful JSON field names and nesting remain unchanged.
3. Top-level `coverImageUrl` remains present on resolution responses.
4. For artists, top-level `coverImageUrl` equals `entity.imageUrl`.
5. For other variants, top-level `coverImageUrl` equals `entity.coverImageUrl`.
6. `label` is not a legal resolved music entity variant.
7. Drizzle rows and `Date` values do not cross the HTTP seam without explicit projection.

## Design Constraints

- The repository uses Effect Tags and Layers for dependency-bearing modules.
- Expected failures use Effect's typed error channel.
- D1 is local-substitutable and must be tested with Miniflare and real migrations.
- The music provider is true external. Production and recording adapters already justify its seam.
- S3 is true external. Production and recording adapters already justify its seam.
- The current fetch function is replaceable in artwork tests and remains an internal seam.
- The shared HTTP schemas use Effect Schema.
- No `as any`, unchecked response cast, module patch, or method spy is allowed.
- `bun precommit` is the final repository validation command.
- Route behavior is verified through existing black-box tests, not route-file unit tests.

## Alternatives Considered

### Option 1: Cleanup only

Delete the dead URL and refresh code from `scrape.service.ts`, leave artwork in callers, and retain the opaque HTTP response record.

```text
URL callers
  -> CanonicalMusicIdentity
  -> caller-owned artwork work
  -> opaque HTTP projection
```

**Depth:** Improves the scrape module deletion result, but leaves canonical results shallow.

**Locality:** Source identity improves. Artwork and response knowledge remain spread across callers.

**Seam placement:** No new seam, but the existing canonical seam still leaks post-resolution work.

**Trade-off:** Lowest immediate effort, but it does not close the feature as one authoritative path.

### Option 2: Canonical module owns the complete result

Keep the current intent-shaped canonical operations. Make their implementation finish artwork delivery when requested and return correlated, persisted music entity variants.

```text
caller intent
  -> CanonicalMusicIdentity interface
  -> source identity implementation
  -> private artwork implementation
  -> persisted correlated result
```

**Depth:** High. Callers ask for resolution, import, enrichment, or refresh and receive the final persisted result.

**Locality:** Source identity ordering and artwork ordering concentrate in one implementation. Artwork byte rules remain in a private internal module.

**Seam placement:** The canonical identity interface stays the external seam. Existing provider, S3, fetch, and D1 seams remain internal to its implementation.

**Trade-off:** The canonical implementation gains artwork dependencies. That is justified because the interface promises the final persisted music entity rather than an intermediate candidate.

### Option 3: Public neighboring artwork module

Create a public `MusicArtworkStorage` Effect Tag. Canonical identity and other callers invoke it directly.

```text
caller
  -> CanonicalMusicIdentity
  -> MusicArtworkStorage interface
  -> caller persists artwork result
```

**Depth:** Artwork storage can be deep, but the end-to-end resolution remains shallow if callers still coordinate persistence and result reconstruction.

**Locality:** Byte validation and S3 mechanics concentrate, while ordering and entity-field policy may still spread.

**Seam placement:** A second public seam appears even though consolidation leaves one main caller. Its production and test adapters are real, but its public exposure gives callers another path around canonical identity.

**Trade-off:** More flexible, but flexibility is not needed for the closeout and creates interface burden.

## Recommendation

Choose Option 2 with one refinement from Option 3: keep artwork delivery as a private module inside the canonical identity implementation, backed by the existing S3 and fetch seams.

Do not collapse the seven existing canonical operations into one command dispatcher or three broad methods. Their intents and invariants differ, and the current interface already provides leverage. This closeout should deepen results and remove leakage, not rename a working interface.

The recommended shape is:

```text
HTTP / import / enrichment caller
  -> CanonicalMusicIdentity interface
      -> source identity implementation
      -> provider adapter
      -> D1 implementation
      -> private artwork delivery module
          -> fetch adapter
          -> S3 adapter
          -> entity artwork persistence
      -> correlated persisted result
  -> exhaustive HTTP projection when applicable
```

The deletion test passes:

- deleting canonical identity would spread parsing, aliases, claims, collisions, provider ordering, artwork policy, persistence, and result correlation across callers;
- deleting the private artwork implementation would spread URL safety, bounded reads, upload ordering, field selection, and persistence back into canonical operations;
- deleting metadata-only scrape would move a real non-URL workflow into the HTTP adapter;
- deleting the old URL and refresh implementation removes complexity without moving it.

## Proposed Design

### Keep intent-shaped canonical operations

Retain:

- `resolveSource`;
- `importProviderEntity`;
- `importProviderEntityLazy`;
- `attachLink`;
- `releaseLink`;
- `enrichEntity`;
- `refreshEntity`.

`importProviderEntityLazy` remains because its interface gives real leverage: a registry hit skips loading the provider snapshot. Moving that lookup ordering into callers would leak source identity implementation.

`enrichEntity` and `refreshEntity` remain separate because they have different invariants:

- enrichment may skip work and preserves canonical metadata;
- administrator refresh always performs provider work and may replace canonical metadata.

### Add explicit artwork delivery policy

Artwork failure policy is not inferred only from `origin`. Origin describes why resolution happened; artwork delivery describes what the caller requires.

```ts
export const ARTWORK_DELIVERY = {
  preserve: 'preserve',
  required: 'required',
  bestEffort: 'best_effort'
} as const

export type ArtworkDelivery =
  (typeof ARTWORK_DELIVERY)[keyof typeof ARTWORK_DELIVERY]
```

Semantics:

- `preserve`: no artwork fetch or upload; return current persisted artwork.
- `required`: attempt delivery when a candidate exists; S3 or artwork-persistence failure fails the operation.
- `best_effort`: attempt delivery when a candidate exists; S3 failure returns the prior persisted music entity and records safe telemetry; D1 persistence failure remains a typed failure.

Current behavior maps as follows:

| Caller | Delivery |
|---|---|
| `POST /api/music/resolve` | `required` |
| URL form of `POST /api/music/:entityType/scrape` | `preserve` |
| Bluesky resolution | `preserve` |
| Spotify playlist import | `best_effort` |
| Spotify track import | `preserve` |
| Track enrichment | `best_effort` |
| Playlist synchronization refresh | `best_effort` |
| Administrator link rescrape | `preserve` |

The table preserves current behavior. Any desired behavior change belongs in a separate decision.

### Finish artwork after identity persistence

Recommended order:

1. Parse source identity and source alias.
2. Resolve, claim, scrape, and detect identity collision.
3. Commit the music entity, links, source identities, and source aliases.
4. Reload the persisted correlated music entity.
5. Select the candidate artwork URL.
6. Apply the requested artwork delivery policy.
7. Upload before changing the D1 artwork field.
8. Persist the correct entity artwork field.
9. Reload the entity if artwork changed.
10. Return the correlated persisted result.

This ordering keeps slow artwork I/O outside claim fencing and avoids uploading for a candidate entity that loses its identity claim. A strict artwork failure may occur after source identity commit. Retry is safe because it resolves the same indexed music entity and retries only the incomplete artwork work.

Concurrent retries may upload the same deterministic key more than once. The final value is stable and no new coordination mechanism is justified.

### Keep the artwork module private

Add:

`apps/server/src/services/canonical-music-identity/artwork-delivery.ts`

Its implementation accepts current dependencies at construction. It is not exported from the canonical identity package and does not receive its own Effect Tag.

```ts
type DeliverMusicArtworkInput<T extends CanonicalMusicEntityType> = {
  readonly resolved: ResolvedMusicEntity<T>
  readonly candidateUrl: string | undefined
  readonly delivery: ArtworkDelivery
}

type DeliverMusicArtwork = <T extends CanonicalMusicEntityType>(
  input: DeliverMusicArtworkInput<T>
) => Effect.Effect<
  ResolvedMusicEntity<T>,
  MusicIdentityArtworkDeliveryFailed | MusicIdentityStorageError
>
```

The private implementation hides:

- approved artwork hosts and suffixes;
- HTTPS enforcement;
- redirect destination approval;
- content type allowlist;
- declared and streamed size limits;
- empty-body rejection;
- deterministic S3 key;
- CDN URL projection;
- `imageUrl` versus `coverImageUrl` selection;
- entity-specific D1 update;
- final entity reload;
- strict and best-effort failure handling;
- safe tracing fields.

### Reduce scrape to metadata-only behavior

Replace the broad scrape input inside the server implementation with a type that forbids URL input:

```ts
export type MusicMetadataScrapeInput = {
  readonly artistName?: string
  readonly albumTitle?: string
  readonly trackTitle?: string
  readonly mbid?: string
  readonly isrc?: string
}

export type ScrapedMusicEntity = {
  readonly entity:
    | SelectMusicArtist
    | SelectMusicAlbum
    | SelectMusicTrack
    | SelectMusicPlaylist
  readonly links: readonly SelectMusicEntityLink[]
}

export const scrapeAndCreateEntityWithoutSourceEffect = (
  scraper: MusicLinkScraperService,
  entityType: ScrapeableMusicEntityType,
  input: MusicMetadataScrapeInput
): Effect.Effect<
  ScrapedMusicEntity,
  DatabaseError | MusicScraperError | ValidationError,
  Database
>
```

The retained implementation owns:

- metadata request validation;
- provider metadata lookup;
- usable-result validation;
- artist-name parsing and association;
- entity creation;
- discovered-link persistence.

Delete from `scrape.service.ts`:

- URL canonicalization;
- exact and normalized URL lookup;
- application-side link scans;
- legacy claim state and wait loops;
- URL-driven source-link insertion;
- `MusicEntityResolutionPending`;
- `MusicEntityResolutionUnavailable`;
- `refreshEntityLinksEffect`;
- refresh source selection;
- refresh metadata merge;
- playlist link replacement.

### Route the preserved mixed scrape request at the HTTP seam

The existing scrape route accepts URL resolution and metadata-only scraping in one request shape. The HTTP adapter owns this protocol distinction:

```ts
const scrapeResult = payload.url
  ? identity.resolveSource({
      url: payload.url,
      expectedType: params.entityType,
      origin: 'manual',
      artworkDelivery: 'preserve'
    })
  : musicEntities.scrapeAndCreateEntityWithoutSource(
      params.entityType,
      payload
    )
```

`MusicEntityService` loses its URL branch and `refreshEntityLinks` pass-through. The HTTP adapter calls `CanonicalMusicIdentity.refreshEntity` directly for the rescrape route.

No second module should hide this one protocol branch. It would fail the deletion test.

### Make internal resolved entities correlated

```ts
export type MusicEntityByType = {
  readonly artist: SelectMusicArtist
  readonly album: SelectMusicAlbum
  readonly track: SelectMusicTrack
  readonly playlist: SelectMusicPlaylist & {
    readonly spotifyUrl?: string | null
  }
}

export type ResolvedMusicEntity<
  T extends CanonicalMusicEntityType = CanonicalMusicEntityType
> = {
  readonly entityType: T
  readonly entity: MusicEntityByType[T]
  readonly links: readonly SelectMusicEntityLink[]
  readonly created: boolean
}

export type AnyResolvedMusicEntity = {
  readonly [T in CanonicalMusicEntityType]: ResolvedMusicEntity<T>
}[CanonicalMusicEntityType]
```

Resolution, import, enrichment, and refresh return this correlated family. `RefreshedMusicEntity` and its leaked `artworkUrl` field are deleted.

### Make HTTP response variants authoritative

In `packages/api/src/music.ts`:

```ts
export const ResolvedArtistResponse = Schema.Struct({
  entityType: Schema.Literal('artist'),
  entity: ArtistResponse,
  links: EntityLinkListResponse,
  coverImageUrl: Schema.NullOr(Schema.String)
})

export const ResolvedAlbumResponse = Schema.Struct({
  entityType: Schema.Literal('album'),
  entity: AlbumResponse,
  links: EntityLinkListResponse,
  coverImageUrl: Schema.NullOr(Schema.String)
})

export const ResolvedTrackResponse = Schema.Struct({
  entityType: Schema.Literal('track'),
  entity: TrackResponse,
  links: EntityLinkListResponse,
  coverImageUrl: Schema.NullOr(Schema.String)
})

export const ResolvedPlaylistResponse = Schema.Struct({
  entityType: Schema.Literal('playlist'),
  entity: PlaylistResponse,
  links: EntityLinkListResponse,
  coverImageUrl: Schema.NullOr(Schema.String)
})

export const ResolvedMusicEntityResponse = Schema.Union([
  ResolvedArtistResponse,
  ResolvedAlbumResponse,
  ResolvedTrackResponse,
  ResolvedPlaylistResponse
])

export type ResolvedMusicEntityResponse =
  typeof ResolvedMusicEntityResponse.Type

export type EmbeddableResolvedMusicEntityResponse = Exclude<
  ResolvedMusicEntityResponse,
  { readonly entityType: 'artist' }
>
```

Keep the top-level `coverImageUrl` for compatibility.

The HTTP adapter owns one exhaustive protocol projection:

```ts
const toResolvedMusicEntityResponse = (
  resolved: AnyResolvedMusicEntity
): ResolvedMusicEntityResponse => {
  switch (resolved.entityType) {
    case 'artist':
      return {
        entityType: 'artist',
        entity: toArtistResponse(resolved.entity),
        links: resolved.links.map(toEntityLinkResponse),
        coverImageUrl: resolved.entity.imageUrl
      }
    case 'album':
      return {
        entityType: 'album',
        entity: toAlbumResponse(resolved.entity),
        links: resolved.links.map(toEntityLinkResponse),
        coverImageUrl: resolved.entity.coverImageUrl
      }
    case 'track':
      return {
        entityType: 'track',
        entity: toTrackResponse(resolved.entity),
        links: resolved.links.map(toEntityLinkResponse),
        coverImageUrl: resolved.entity.coverImageUrl
      }
    case 'playlist':
      return {
        entityType: 'playlist',
        entity: toPlaylistResponse(resolved.entity),
        links: resolved.links.map(toEntityLinkResponse),
        coverImageUrl: resolved.entity.coverImageUrl
      }
  }
}
```

Replace `ScrapeEntityLinksResponse.entity` with the union of existing entity response schemas while preserving `{ entity, links }`:

```ts
export const ScrapeEntityLinksResponse = Schema.Struct({
  entity: Schema.Union([
    ArtistResponse,
    AlbumResponse,
    TrackResponse,
    PlaylistResponse
  ]),
  links: EntityLinkListResponse
})
```

Delete `toJsonEntity`. Every response uses an existing explicit projection.

### Remove duplicate web response schemas

`apps/www/src/lib/music-entity-resolution.ts` imports the shared response schema and type. It keeps only authoring policy and editor-reference parsing.

```ts
import {
  ResolvedMusicEntityResponse,
  type EmbeddableResolvedMusicEntityResponse
} from '@gbfm/api/music'

export type ResolvedMusicEntity =
  EmbeddableResolvedMusicEntityResponse

export const ensureEmbeddableMusicEntity = (
  resolved: ResolvedMusicEntityResponse
) =>
  resolved.entityType === 'artist'
    ? Effect.fail(
        new MusicEntityResolutionFailed({
          message: 'Artist links cannot be attached to posts'
        })
      )
    : Effect.succeed(resolved)
```

The generated client already decodes through the shared schema. The web module must not define another artist/entity/link response union.

## Domain Model and Types

No new user-facing domain term is required. Existing terms remain authoritative:

- music entity;
- source identity;
- source alias;
- resolution;
- refresh;
- identity collision.

The closeout adds one operation policy value, `ArtworkDelivery`, which controls failure semantics without becoming a new domain entity.

### Artwork delivery policy

```ts
export type ArtworkDelivery =
  | 'preserve'
  | 'required'
  | 'best_effort'
```

### Correlated entity family

```ts
export type MusicEntityByType = {
  readonly artist: SelectMusicArtist
  readonly album: SelectMusicAlbum
  readonly track: SelectMusicTrack
  readonly playlist: SelectMusicPlaylist & {
    readonly spotifyUrl?: string | null
  }
}
```

### Typed artwork failure

```ts
export class MusicIdentityArtworkDeliveryFailed extends Schema.TaggedError<
  MusicIdentityArtworkDeliveryFailed
>()('MusicIdentityArtworkDeliveryFailed', {
  entityType: Schema.Literals(['artist', 'album', 'track', 'playlist']),
  entityId: Schema.String,
  operation: Schema.Literals(['upload', 'persist']),
  message: Schema.String
}) {}
```

The error carries no raw artwork URL, response body, credentials, bucket values, or arbitrary cause serialization.

`MusicIdentityStorageError` remains the typed D1 failure. Required artwork upload failure uses `MusicIdentityArtworkDeliveryFailed`. Best-effort upload failure is observed and converted to the unchanged persisted result inside the canonical implementation.

## Types, Interfaces, and HTTP Contracts

### Changed canonical inputs

```ts
export type ResolveMusicSource = {
  readonly url: string
  readonly expectedType?: CanonicalMusicEntityType
  readonly origin: ResolutionOrigin
  readonly artworkDelivery: ArtworkDelivery
}

export type ImportProviderMusicEntity = {
  readonly snapshot: ProviderMusicSnapshot
  readonly origin: 'spotify_import' | 'playlist_enrichment'
  readonly artworkDelivery: ArtworkDelivery
}

export type ImportProviderMusicEntityLazy<E, R> = {
  readonly entityType: CanonicalMusicEntityType
  readonly sourceUrl: string
  readonly origin: 'spotify_import' | 'playlist_enrichment'
  readonly artworkDelivery: ArtworkDelivery
  readonly loadSnapshot: Effect.Effect<ProviderMusicSnapshot, E, R>
}

export type RefreshMusicEntity = {
  readonly entityType: CanonicalMusicEntityType
  readonly entityId: string
  readonly actorId: string
  readonly origin: 'manual' | 'playlist_enrichment'
  readonly artworkDelivery: ArtworkDelivery
}
```

`attachLink` and `releaseLink` inputs do not gain artwork policy.

### Changed canonical outputs

```ts
export interface CanonicalMusicIdentityService {
  readonly resolveSource: (
    input: ResolveMusicSource
  ) => Effect.Effect<AnyResolvedMusicEntity, MusicIdentityError>

  readonly importProviderEntity: (
    input: ImportProviderMusicEntity
  ) => Effect.Effect<AnyResolvedMusicEntity, MusicIdentityError>

  readonly importProviderEntityLazy: <E, R>(
    input: ImportProviderMusicEntityLazy<E, R>
  ) => Effect.Effect<AnyResolvedMusicEntity, MusicIdentityError | E, R>

  readonly attachLink: (
    input: AttachMusicSourceLink
  ) => Effect.Effect<SelectMusicEntityLink, MusicIdentityError>

  readonly releaseLink: (
    input: ReleaseMusicSourceLink
  ) => Effect.Effect<SelectMusicEntityLink | undefined, MusicIdentityError>

  readonly enrichEntity: (
    input: RefreshMusicEntity
  ) => Effect.Effect<AnyResolvedMusicEntity, MusicIdentityError>

  readonly refreshEntity: (
    input: RefreshMusicEntity
  ) => Effect.Effect<AnyResolvedMusicEntity, MusicIdentityError>
}
```

During implementation, generic overloads may preserve a known `expectedType` in the return type if they do not require assertions or widen the interface. The minimum requirement is the safe correlated union.

### HTTP error mapping

Existing mappings remain:

| Typed failure | HTTP result |
|---|---|
| Invalid source or provider rejection | `400` |
| Missing music entity or source link | `404` |
| Identity collision | `409` |
| Busy identity or provider unavailable | `503`, with existing `Retry-After` behavior |
| D1 or required artwork failure | Existing logged `500` behavior |

No new public error body is introduced.

## Seams, Adapters, and Implementations

### External canonical identity seam

`CanonicalMusicIdentityService` remains the interface used by HTTP, Bluesky, Spotify import, playlist, and music entity modules.

### Provider seam

`MusicLinkScraperService` remains the true-external interface. Production provider implementations and recording test adapters already justify the seam. This closeout does not rename or widen it.

### D1 seam

`Database` plus `CanonicalMusicIdentityRepository` remain a local-substitutable internal seam. Tests use Miniflare D1 and real migrations. Do not add a repository interface or in-memory repository adapter.

### S3 seam

`S3Service` remains the true-external interface. Production and recording adapters already justify the seam. The private artwork module depends on the narrow `uploadFile` behavior.

### Fetch seam

`MusicCoverImageFetch` remains an internal seam with production `fetch` and a deterministic test adapter. It must not become part of the canonical identity interface.

### Private artwork implementation

`artwork-delivery.ts` owns the end-to-end policy from candidate URL to persisted correlated result. It may reuse pure artwork parsing and bounded-read functions from `music-cover-image.service.ts` during an incremental move, but the final caller-facing copy helpers are deleted.

## Call Stacks and Data Flow

### Current: authoring resolution

```text
ResolveMusicEntityInput DTO
  -> MusicHandlersLive authentication
  -> CanonicalMusicIdentity.resolveSource
      -> parseMusicSource
      -> indexed D1 lookup or claim
      -> MusicLinkScraperService on miss
      -> collision checks
      -> guarded D1 commit
      -> raw resolved music entity
  -> infer candidate artwork field
  -> copyMusicCoverImageEffect
      -> fetch
      -> bounded response read
      -> S3Service.uploadFile
  -> entity-type switch
  -> MusicEntityService update operation
  -> manual object reconstruction
  -> toJsonEntity
  -> opaque ResolvedMusicEntityResponse
```

### Proposed: authoring resolution

```text
ResolveMusicEntityInput DTO
  -> MusicHandlersLive authentication
  -> CanonicalMusicIdentity.resolveSource
      -> parseMusicSource
      -> indexed D1 lookup or claim
      -> MusicLinkScraperService on miss
      -> collision checks
      -> guarded D1 commit
      -> private artwork delivery
          -> fetch adapter
          -> bounded response read
          -> S3Service upload adapter
          -> D1 artwork update
          -> entity reload
      -> AnyResolvedMusicEntity
  -> toResolvedMusicEntityResponse
  -> ResolvedMusicEntityResponse variant
```

### Current: URL scrape

```text
ScrapeEntityLinksInput DTO with url
  -> MusicHandlersLive
  -> MusicEntityService.scrapeAndCreateEntity
  -> CanonicalMusicIdentity.resolveSource
  -> opaque scrape response projection
```

The old URL implementation remains present but bypassed.

### Proposed: URL scrape

```text
ScrapeEntityLinksInput DTO with url
  -> MusicHandlersLive protocol branch
  -> CanonicalMusicIdentity.resolveSource
      artworkDelivery: preserve
  -> exhaustive scrape response projection
```

### Current: metadata-only scrape

```text
ScrapeEntityLinksInput DTO without url
  -> MusicHandlersLive
  -> MusicEntityService.scrapeAndCreateEntity
  -> scrapeAndCreateEntityEffect
  -> provider adapter
  -> entity and link persistence
  -> opaque scrape response projection
```

### Proposed: metadata-only scrape

```text
ScrapeEntityLinksInput DTO without url
  -> MusicHandlersLive protocol branch
  -> MusicEntityService.scrapeAndCreateEntityWithoutSource
  -> scrapeAndCreateEntityWithoutSourceEffect
  -> provider adapter
  -> entity and link persistence
  -> exhaustive scrape response projection
```

### Current: track enrichment

```text
playlist enrichment
  -> CanonicalMusicIdentity.enrichEntity
  -> RefreshedMusicEntity.artworkUrl
  -> copyMusicCoverImageBestEffort
  -> updateTrackEffect
  -> caller counts links
```

### Proposed: track enrichment

```text
playlist enrichment
  -> CanonicalMusicIdentity.enrichEntity
      artworkDelivery: best_effort
      -> provider adapter
      -> collision-safe D1 update
      -> private artwork delivery
      -> persisted AnyResolvedMusicEntity
  -> caller counts links
```

### Current: playlist import

```text
Spotify playlist adapter
  -> copyMusicCoverImageBestEffort
  -> CanonicalMusicIdentity.importProviderEntity
  -> reload playlist from D1
  -> playlist membership update
```

### Proposed: playlist import

```text
Spotify playlist adapter
  -> CanonicalMusicIdentity.importProviderEntity
      artworkDelivery: best_effort
      -> identity commit
      -> private artwork delivery
      -> persisted playlist variant
  -> playlist membership update using returned entity
```

### Current: playlist synchronization

```text
syncPlaylistLinksEffect
  -> CanonicalMusicIdentity.refreshEntity
  -> RefreshedMusicEntity.artworkUrl
  -> copyMusicCoverImageBestEffort
  -> direct D1 playlist artwork update
  -> schedule track enrichment
```

### Proposed: playlist synchronization

```text
syncPlaylistLinksEffect
  -> CanonicalMusicIdentity.refreshEntity
      artworkDelivery: best_effort
      -> provider adapter
      -> collision-safe metadata update
      -> private artwork delivery
      -> persisted playlist variant
  -> schedule track enrichment
```

### Current: administrator rescrape

```text
rescrape HTTP DTO
  -> MusicEntityService.refreshEntityLinks
  -> CanonicalMusicIdentity.refreshEntity
  -> links-only HTTP projection
```

### Proposed: administrator rescrape

```text
rescrape HTTP DTO
  -> CanonicalMusicIdentity.refreshEntity
      artworkDelivery: preserve
  -> links-only HTTP projection
```

### Failure flow

```text
invalid source
  -> MusicSourceInvalid
  -> existing HTTP mapping
  -> 400
```

```text
identity collision
  -> conflict recorded in D1
  -> MusicIdentityConflict
  -> existing HTTP mapping
  -> 409
```

```text
live claim
  -> MusicIdentityBusy
  -> existing HTTP mapping
  -> 503 and Retry-After
```

```text
required artwork upload fails
  -> MusicIdentityArtworkDeliveryFailed
  -> safe error report
  -> existing 500 behavior
  -> indexed identity remains
  -> retry targets the same music entity
```

```text
best-effort artwork upload fails
  -> safe error report inside canonical implementation
  -> unchanged persisted music entity
  -> successful caller result
```

```text
S3 upload succeeds, D1 artwork update fails
  -> MusicIdentityStorageError
  -> no successful result
  -> deterministic object may be unreferenced
  -> retry reuses the key and repairs D1
```

### Retry, cancellation, and idempotency flow

- Existing source identity retries return the indexed music entity.
- Provider calls remain protected by current claim ownership and heartbeat behavior.
- Artwork work starts only after identity commit, so it does not hold a claim during image transfer.
- Existing deterministic artwork keys make repeated uploads idempotent at the resulting URL.
- No new hidden cancellation lifetime is added. Existing Effect interruption reaches provider and adapter behavior to the extent their current interfaces support it.
- Existing detached playlist enrichment remains runtime-owned by `Effect.forkDetach`; this closeout preserves its logging and bounded concurrency behavior.

### Observability flow

Retain existing identity spans and add or preserve one artwork span inside canonical identity:

```text
musicIdentity.resolveSource
  -> musicIdentity.lookup
  -> musicIdentity.claim
  -> musicIdentity.scrape
  -> musicIdentity.commit
  -> musicIdentity.artwork
```

Safe fields:

- origin;
- source platform;
- source entity type;
- hashed source key;
- music entity type and ID;
- result: hit, miss, wait, reclaimed, created, reused;
- explicit refresh;
- artwork delivery policy and outcome;
- typed error tag.

Do not record raw source URLs, artwork URLs, query parameters, provider payloads, owner tokens, credentials, bucket values, or arbitrary thrown values.

## Legacy Repair-Fallback Gate

The indexed identity registry should eventually become authoritative without scanning `music_entity_links`. Removing `legacyCandidates`, `findLegacyReference`, and `adoptLegacy` is part of feature closeout only after evidence proves the rollout gate.

Required evidence:

1. Production backfill generation is complete.
2. Backfill lag is zero at the chosen observation point.
3. All recorded collisions and orphan findings have been reviewed.
4. A bounded production audit shows no unresolved aliases or identities that depend on legacy adoption.
5. Provider request count and resolution failure rate remain within baseline after indexed read cutover.
6. The rollback plan does not require application-side legacy scanning.

If evidence passes, include deletion of:

- `legacyFallbackType`;
- `findLegacyReference`;
- `adoptLegacy`;
- `CanonicalMusicIdentityRepository.legacyCandidates`;
- legacy-adoption tests and telemetry values.

If evidence is unavailable or fails, retain this repair fallback in the first code change and create a separately gated cleanup change. Do not infer production readiness from local tests.

The legacy `music_entity_resolution_claims` table is not dropped in either case. Schema and data cleanup require separate explicit approval.

## Files to Add / Change / Delete

### Add

| File | Ownership |
|---|---|
| `apps/server/src/services/canonical-music-identity/artwork-delivery.ts` | Private artwork selection, validation, S3 ordering, D1 field update, reload, and policy handling. |

### Change

| File | Ownership after change |
|---|---|
| `apps/server/src/services/canonical-music-identity/contract.ts` | Correlated result family, artwork delivery policy, and precise existing operation inputs. |
| `apps/server/src/services/canonical-music-identity/index.ts` | Resolution and import sequencing through private artwork delivery. |
| `apps/server/src/services/canonical-music-identity/entity-operations.ts` | Enrichment and refresh sequencing through private artwork delivery; no leaked `artworkUrl`. |
| `apps/server/src/services/canonical-music-identity/repository.ts` | Entity artwork update and reload support; optional legacy fallback deletion only after the gate. |
| `apps/server/src/services/canonical-music-identity/errors.ts` | Precise required-artwork failure in `MusicIdentityError`. |
| `apps/server/src/services/music-entity/scrape.service.ts` | Metadata-only scrape implementation. |
| `apps/server/src/services/music-entity/index.ts` | Metadata-only scrape interface; remove URL and refresh forwarding and obsolete legacy error. |
| `apps/server/src/services/music-entity/playlist-tracks.service.ts` | Remove artwork choreography and use canonical returned entities. |
| `apps/server/src/http/music.handlers.ts` | Protocol branching, direct canonical refresh, exhaustive response projections, and no route-owned artwork work. |
| `apps/server/src/http/music-identity-http.ts` | Translate required artwork failure to existing safe 500 handling. |
| `apps/server/src/runtime/services.ts` | Provide existing S3/config/fetch dependencies to canonical identity implementation. |
| `packages/api/src/music.ts` | Authoritative correlated resolution variants and concrete scrape entity union. |
| `apps/www/src/lib/music-entity-resolution.ts` | Consume shared schema and retain only authoring policy and cache behavior. |

### Delete or reduce

| File | Change |
|---|---|
| `apps/server/src/services/music-cover-image.service.ts` | Delete public copy helpers after private artwork implementation absorbs behavior. Keep a private pure file only if URL/response parsing remains clearer there. |
| `apps/server/src/services/music-entity/scrape.service.d1.test.ts` | Delete URL identity, claim, contention, and refresh tests; retain metadata-only behavior tests. |
| `apps/server/src/services/music-cover-image.service.test.ts` | Replace helper-level tests with canonical interface behavior tests and delete the file when no public module remains. |

### Tests to change

| File | Test responsibility |
|---|---|
| `apps/server/src/services/canonical-music-identity/canonical-music-identity.d1.test.ts` | Identity plus artwork behavior through the canonical interface with Miniflare D1 and recording adapters. |
| `apps/server/src/http/routes.blackbox.test.ts` | Unchanged routes, statuses, authorization, and exact successful response shapes. |
| `packages/api/src/music.test.ts` | Every response variant, mismatched variant rejection, date encoding, and scrape body shape. |
| `apps/www/src/lib/music-entity-resolution.test.ts` | Shared response consumption, artist rejection, embeddable variants, and unchanged cache behavior. |
| `apps/server/src/services/music-entity/playlist-tracks.service.d1.test.ts` | Playlist import, enrichment, and sync outcomes without caller-owned artwork work. |

No files under `apps/server/drizzle-d1/` or schema declarations change.

## RGR TDD Test Plan

Work in vertical Red-Green-Refactor slices. Each slice starts with one failing behavior test through the interface named below, adds the minimum implementation, returns to green, then refactors.

### Slice 1: Correlate shared resolution responses

**Red:** Add one package schema test proving an artist response decodes and an artist discriminant paired with an album shape fails.

**Green:** Add the four resolved response variants and union in `packages/api/src/music.ts`.

**Refactor:** Export the shared response type and embeddable exclusion without changing route wiring.

### Slice 2: Project one correlated server result

**Red:** Add one black-box test for a track resolution body decoded through the new shared schema.

**Green:** Add `AnyResolvedMusicEntity` and the exhaustive HTTP projection for the track path.

**Refactor:** Complete artist, album, and playlist cases through existing projection functions; delete `toJsonEntity` when all paths use explicit projection.

### Slice 3: Move strict interactive artwork behind canonical identity

**Red:** Through `CanonicalMusicIdentity.resolveSource` with Miniflare D1 and recording S3/fetch adapters, prove an editorial miss stores artwork, persists `coverImageUrl`, and returns the reloaded track.

**Green:** Add private artwork delivery and wire `artworkDelivery: required` for this path.

**Refactor:** Keep host, redirect, content type, size, and key behavior local to the private implementation.

### Slice 4: Preserve strict failure behavior

**Red:** Through the canonical interface, prove S3 failure returns `MusicIdentityArtworkDeliveryFailed`, keeps the indexed music entity, and does not persist the CDN URL.

**Green:** Add typed failure translation and upload-before-update ordering.

**Refactor:** Preserve safe tracing and existing HTTP 500 behavior.

### Slice 5: Make retry repair artwork without provider work

**Red:** Resolve after the strict failure and prove the same music entity is returned, the provider adapter is not called again, and artwork is repaired.

**Green:** Run artwork delivery on a registry hit when policy is not `preserve` and persisted artwork is still external.

**Refactor:** Keep retry logic inside the canonical implementation.

### Slice 6: Move best-effort playlist artwork

**Red:** Through `importProviderEntity`, prove playlist artwork upload failure returns the persisted playlist unchanged.

**Green:** Add `best_effort` policy and route playlist import through private artwork delivery.

**Refactor:** Remove pre-copy and post-update code from `playlist-tracks.service.ts` for playlist import.

### Slice 7: Move enrichment artwork

**Red:** Through `enrichEntity`, prove remote artwork is stored and the returned track matches D1.

**Green:** Return the correlated result from enrichment and finish artwork internally.

**Refactor:** Remove `artworkUrl`, copy calls, and `updateTrackEffect` from the enrichment caller.

### Slice 8: Move playlist synchronization artwork

**Red:** Through `refreshEntity`, prove best-effort playlist artwork behavior and stable playlist ID.

**Green:** Finish playlist artwork inside canonical refresh.

**Refactor:** Remove direct playlist artwork updates and S3/config arguments from synchronization code.

### Slice 9: Preserve administrator rescrape

**Red:** Add a black-box rescrape test proving the existing links-only success body and error mapping.

**Green:** Call `CanonicalMusicIdentity.refreshEntity` directly from the HTTP adapter with `preserve`.

**Refactor:** Delete `MusicEntityService.refreshEntityLinks` pass-through.

### Slice 10: Split URL and metadata scrape behavior

**Red:** Add one metadata-only behavior test through `MusicEntityService.scrapeAndCreateEntityWithoutSource` proving entity and links persist without identity rows.

**Green:** Extract the retained no-source implementation and route the no-URL HTTP branch to it.

**Refactor:** Route URL input directly to canonical identity; remove URL branches from the music entity module.

### Slice 11: Delete superseded URL identity and refresh implementation

**Red:** Existing canonical interface and black-box tests remain green before deletion. Add no new implementation-coupled test.

**Green:** Delete legacy claim, URL resolution, and refresh code plus their direct tests from `scrape.service.ts`.

**Refactor:** Remove obsolete imports, errors, and exports. Confirm no references remain.

### Slice 12: Remove duplicate web schema

**Red:** Add a web test proving the shared artist variant is rejected while album, track, and playlist variants remain embeddable.

**Green:** Import the shared schema/type and delete local response schemas.

**Refactor:** Keep only cache normalization and authoring policy in the web module.

### Slice 13: Optional legacy repair-fallback deletion

Run only when the production evidence gate is approved.

**Red:** Add canonical interface tests proving an indexed miss does not scan legacy links and follows normal resolution.

**Green:** Remove legacy fallback lookup and adoption.

**Refactor:** Delete repository scan methods, telemetry values, and fallback tests. Keep schema and data untouched.

### Final verification

1. Focused package contract tests.
2. Canonical identity Miniflare D1 tests.
3. Metadata-only scrape D1 tests.
4. Playlist import and synchronization D1 tests.
5. HTTP black-box tests.
6. Web resolution tests.
7. `bun precommit`.

## Risks and Open Questions

### Risk: source identity commits before strict artwork succeeds

A failed interactive request may leave a valid indexed identity with remote artwork. This matches the safest claim ordering and makes retry repair possible without duplicate music entities. Tests must prove retry behavior.

### Risk: response schemas expose existing projection drift

Replacing an opaque record with exact variants may reveal fields whose current runtime shape differs from the documented entity schemas. Treat those failures as projection defects, not reasons to weaken the shared interface.

### Risk: broader canonical dependencies

The canonical implementation gains S3, CDN config, and fetch dependencies. The external interface stays cohesive because callers receive a final persisted music entity. Keep these dependencies internal and do not expose bucket or URL mechanics.

### Risk: detached enrichment ownership

This closeout preserves current detached enrichment behavior. It does not prove stronger durability. Any move to queues or workflows is separate.

### Risk: legacy fallback may still protect production rows

Deleting it without rollout evidence can cause known legacy sources to scrape again or create duplicates. The evidence gate is mandatory.

### Open question 1: Include repair-fallback deletion now?

**Recommendation:** only if production maintenance and telemetry evidence satisfies the gate. Otherwise make it a follow-up cleanup change.

### Open question 2: Keep `music-cover-image.service.ts` as a private pure module?

**Recommendation:** keep a precisely named private file only if it improves locality for URL and response parsing. Delete the exported copy interface and direct helper tests either way.

### Open question 3: Should D1 artwork persistence failure be best effort?

**Recommendation:** no. S3 failure can be best effort where existing behavior permits it, but a successful upload followed by a failed D1 update must return a typed failure. Returning success would violate the persisted-result invariant.

### Open question 4: Should administrator rescrape begin updating artwork?

**Recommendation:** no. Preserve current route behavior with `artworkDelivery: preserve`. A behavior change can be planned separately.

### Open question 5: Should the canonical interface be compressed to fewer methods?

**Recommendation:** no. Existing operations represent different invariants and already form a deep interface. Compressing them into broad command/result unions would lower type precision without useful leverage.

## Acceptance Criteria

- Production URL resolution and refresh have one implementation behind `CanonicalMusicIdentity`.
- `scrape.service.ts` contains only metadata-driven no-source behavior.
- No direct test exercises superseded URL claim or refresh code.
- Interactive resolution, playlist import, enrichment, and playlist synchronization no longer coordinate artwork outside canonical identity.
- Canonical operations return correlated persisted music entity variants.
- `RefreshedMusicEntity.artworkUrl` is removed.
- `ResolvedMusicEntityResponse` has exact artist, album, track, and playlist variants.
- `ScrapeEntityLinksResponse` no longer exposes an unknown entity record.
- The web resolution module no longer defines a duplicate response schema.
- Existing routes, authorization, successful response bodies, and status mappings remain compatible.
- Every changed persistence behavior is verified with Miniflare D1.
- Provider and S3 behavior is replaced only through real seams.
- No D1 schema or production data changes occur.
- Legacy repair-fallback deletion happens only with approved production evidence.
- `bun precommit` passes.
