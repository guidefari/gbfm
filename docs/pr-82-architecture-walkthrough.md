# PR #82 Architecture Walkthrough

This is a reviewer-oriented walkthrough of the music metadata pull request so you can come back to it with no context and rebuild the mental model quickly.

## What this PR adds

This PR introduces a new music metadata subsystem in the VPS app for managing:

- artists
- albums
- tracks
- playlists
- cross-platform links for those entities

It also adds link scraping so an admin can start from one known URL or a small amount of metadata and expand that into more platform links.

The core goal is to move from provider-specific handling toward a platform-agnostic music model.

## High-level architecture

```text
HTTP API
  |
  v
/music routes
  |
  v
route handlers
  |
  v
MusicEntityService ---------------------> MusicLinkScraperService
  |                                              |
  |                                              v
  |                                       Odesli / MusicBrainz / Firecrawl
  v
Drizzle schema + migrations
  |
  v
Postgres tables
```

In code, the main layers are:

- route definitions in `apps/vps/src/routes/music/music.routes.ts`
- route handlers in `apps/vps/src/routes/music/music.handlers.ts`
- business logic in `apps/vps/src/services/music-entity.service.ts`
- scraping/provider logic in `apps/vps/src/services/music-link-scraper.service.ts`
- database model in `apps/vps/src/db/music-entity.schema.ts`
- migration in `apps/vps/drizzle/0033_lucky_mastermind.sql`

## Where it is wired into the app

The router is registered in:

- `apps/vps/src/routes/music/music.index.ts`
- `apps/vps/src/app.ts`

Runtime service registration happens in:

- `apps/vps/src/runtime/index.ts`
- `apps/vps/src/runtime/services.ts`

That means the feature is fully part of the VPS API surface, not a standalone utility.

## Domain model

The data model has three main parts.

### 1. Core music entities

Defined in `apps/vps/src/db/music-entity.schema.ts`:

- `music_artists`
- `music_albums`
- `music_tracks`
- `music_playlists`

These are the primary records the API manages.

### 2. Artist relationship tables

Also in `apps/vps/src/db/music-entity.schema.ts`:

- `music_album_artists`
- `music_track_artists`

These are junction tables for many-to-many relationships.

### 3. Cross-platform links

The core abstraction is `music_entity_links`:

- `entityType`
- `entityId`
- `platform`
- `url`
- `status`
- `scrapedAt`
- `verifiedAt`
- `verifiedBy`
- `metadata`

This table lets one entity store many external links without baking platform-specific columns into every entity table.

## Lookup-table design

Instead of hardcoding everything as DB enums, the PR uses lookup tables:

- `music_entity_types`
- `music_platforms`

Those are defined in `apps/vps/src/db/music-entity.schema.ts` and seeded by:

- `apps/vps/src/db/seed-music-lookups.ts`
- `apps/vps/scripts/seed-music-lookups.ts`

The migration/seed flow is wired through:

- `apps/vps/src/migrate.ts`
- `apps/vps/package.json`

The practical result is:

- Postgres enforces valid entity types and platforms with FKs
- platform metadata can live in the DB
- fresh DBs can be migrated and seeded automatically

## API shape

The route surface is defined in `apps/vps/src/routes/music/music.routes.ts`.

At a high level, it provides:

- CRUD for artists
- CRUD for albums
- CRUD for tracks
- CRUD for playlists
- list/add/update/delete entity links
- scrape links for an entity
- list pending links for review
- manage artist/album and artist/track relationships

The route handlers in `apps/vps/src/routes/music/music.handlers.ts` are intentionally thin. They:

- validate request data
- call the service layer
- map Effect errors into HTTP responses

The real behavior lives in the service layer.

## Service-layer architecture

The main business logic lives in `apps/vps/src/services/music-entity.service.ts`.

This service handles:

- entity CRUD
- artist junction writes
- link reads and upserts
- pending review queries
- scrape orchestration

The pattern is:

```text
handler
  -> service method
    -> Drizzle query/effect
      -> DB row(s)
```

Notable design choices:

- create/update/delete methods are grouped by entity type
- link persistence is centralized instead of being spread across route handlers
- scraped links are persisted through the same link flow used by manual link insertion
- Effect spans are used throughout for traceability

## Scraper architecture

The scraping subsystem is in `apps/vps/src/services/music-link-scraper.service.ts`.

It follows a provider pattern:

- `OdesliProvider`
- `MusicBrainzProvider`
- `FirecrawlProvider`

The scraper service runs providers, merges their outputs, and returns a normalized result.

### Scraper flow

```text
scrape request
  -> MusicEntityService.scrapeLinksForEntity(...)
    -> MusicLinkScraperService.scrape(...)
      -> provider 1
      -> provider 2
      -> provider 3 (if configured)
    -> merge links by platform
    -> persist links as pending_review
```

Important behavior:

- later providers can override earlier links for the same platform
- provider failures are logged and swallowed rather than failing the whole scrape
- scraped links are stored in `music_entity_links`

## Auth and review workflow

One of the important follow-up fixes in this branch is route protection.

Music write/review routes are now protected with admin middleware in:

- `apps/vps/src/routes/music/music.routes.ts`

That middleware comes from:

- `apps/vps/src/middlewares/better-auth.middleware.ts`

Current intended model:

- reads are public
- writes and review actions are admin-only

That includes:

- create/update/delete entity endpoints
- link add/update/delete
- scrape endpoints
- pending review queue
- artist junction management

## Link review model

The review flow centers on `music_entity_links.status`.

Statuses:

- `pending_review`
- `verified`
- `rejected`

The important safeguard added in the follow-up fixes is that link review mutations are now scoped by:

- `entityType`
- `entityId`
- `linkId`

That logic is enforced in:

- `apps/vps/src/routes/music/music.handlers.ts`
- `apps/vps/src/services/music-entity.service.ts`

This keeps the route contract honest and prevents a client from mutating an unrelated link just by knowing its UUID.

## Migration story

Database changes are introduced by:

- `apps/vps/drizzle/0033_lucky_mastermind.sql`
- `apps/vps/drizzle/meta/0033_snapshot.json`
- `apps/vps/drizzle/meta/_journal.json`

The migration creates all new music tables, including the lookup tables and the polymorphic link table.

One important improvement made after review is that lookup seeding is now part of the migration flow, so a fresh environment is less likely to end up with valid schema but unusable FK-constrained lookup references.

## Mental model for reviewing the code

If you want the quickest way back into the PR, review it in this order:

1. `apps/vps/src/db/music-entity.schema.ts`
2. `apps/vps/src/routes/music/music.routes.ts`
3. `apps/vps/src/services/music-entity.service.ts`
4. `apps/vps/src/services/music-link-scraper.service.ts`
5. `docs/features/music-metadata.md`

Why this order works:

- schema tells you what exists
- routes tell you what is exposed
- service tells you how it really behaves
- scraper explains enrichment/discovery behavior
- docs show intended usage and setup

## Short walkthrough by concern

### Data storage

- core entities live in dedicated tables
- many-to-many artist relationships use junction tables
- platform links live in one polymorphic table

### API behavior

- handlers are thin and mostly delegate
- service owns DB logic and orchestration
- OpenAPI/Zod schemas define the request/response contracts

### Scraping

- providers normalize external lookups
- results are merged and persisted
- scraped links enter the review flow as pending

### Security and operations

- admin middleware protects mutations
- verified links record the acting user id
- migrations now seed required lookup rows

## What changed after the original implementation

This branch does not just contain the original feature. It also includes fixes discovered during review:

- admin auth added to music mutation/review endpoints
- entity-scoped enforcement for link updates/deletes
- `verifiedBy` fixed to use the authenticated user id
- auto-seeding for music lookup tables added to migration flow
- docs updated to better match the actual implementation

## Current reviewer checkpoints

If you are scanning for correctness, these are the highest-value places to look:

- `apps/vps/src/db/music-entity.schema.ts` for table design and API schema shape
- `apps/vps/src/services/music-entity.service.ts` for link upsert and mutation rules
- `apps/vps/src/services/music-link-scraper.service.ts` for provider precedence and fallback behavior
- `apps/vps/src/routes/music/music.routes.ts` for public vs admin-only surface area
- `apps/vps/src/migrate.ts` and `apps/vps/src/db/seed-music-lookups.ts` for fresh-environment setup safety

## One-paragraph summary

This PR adds a full VPS-side architecture for platform-agnostic music metadata: normalized entity tables, a polymorphic link model, admin-managed review flows, provider-based scraping, and migration-backed lookup seeding. The main code lives in the new music schema, service, routes, and scraper files, and the branch also includes follow-up hardening so the feature is safer to review and deploy than the original version.
