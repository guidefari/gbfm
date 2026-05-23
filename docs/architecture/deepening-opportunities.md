# Architectural Deepening Opportunities

Surfaced via `/improve-codebase-architecture` — 2026-05-23.

---

## 1. Error handler is a shallow pass-through

**Files**: every `*.handlers.ts` in `/apps/vps/src/routes/*/`

**Problem**: Each handler manually repeats `Effect.catchTag('DatabaseError', ...)` + `Effect.catchTag('NotFoundError', ...)` etc. The error-to-HTTP mapping lives scattered across ~12 handler files. The mapping logic is identical everywhere.

**Solution**: Single `effectToHono` wrapper that runs any Effect and maps the error union to HTTP responses. Handlers become pure Effect programs; the seam owns all HTTP error translation.

**Benefits**: Error mapping logic concentrated in one place (locality). New error types added in one file. Handlers testable as pure Effects with no HTTP scaffolding.

---

## 2. Music entity services are five shallow copies

**Files**: `/apps/vps/src/services/music-entity/{artist,album,track,playlist,link}.service.ts`

**Problem**: All five implement near-identical CRUD patterns against the same `music_entity_*` tables. Each is a thin wrapper over Drizzle with minor field differences. The differentiation is in the schema, not the behaviour.

**Solution**: Generic `MusicEntityService<T>` backed by a single deep module that takes a schema descriptor. Individual entity services become thin adapters (one line each) that configure the generic.

**Benefits**: Bug fixes to CRUD logic apply everywhere. New entity type = one descriptor, not a new file. Tests cover the generic; entity-specific tests only cover entity-specific constraints.

---

## 3. Music link scraper has no seam

**Files**: `/apps/vps/src/services/music-link-scraper.service.ts`, `spotify.service.ts`

**Problem**: Spotify URL detection (`isSpotifyUrl`, etc.) lives in `spotify.service.ts` but is used by the scraper. The scraper calls Odesli, MusicBrainz, and Firecrawl directly — three external APIs with no adapter seam.

**Solution**: Define a `MusicLinkProvider` interface. Each external API becomes an adapter. The scraper becomes a coordinator that asks providers, not a blob that knows all three APIs.

**Benefits**: Each provider testable in isolation. Adding a new platform = new adapter, scraper unchanged. URL detection moves to providers where it belongs.

---

## 4. Mix processing has hidden coupling to filesystem paths (deprecated)

**Files**: `/packages/core/src/mix-processing/processing.ts`, `filesystem.ts`

**Problem**: The processing pipeline writes temp files to disk and calls FFmpeg via subprocess — both are hard-coded side effects inside what could be a pure transformation pipeline. Tests mock the filesystem but the real bugs are in the orchestration (no locality).

**Solution**: Explicit `MixProcessingEnv` interface carrying `writeFile`, `execProcess`, `tempDir`. The pipeline becomes a pure Effect program parameterised on its environment. No mocks needed — tests inject fakes through the interface.

**Benefits**: Pipeline testable end-to-end without touching disk or spawning FFmpeg. Switching from local FFmpeg to a cloud transcoder = swap one adapter.

---

## 5. Frontend store + query are doing the same job ⬅ exploring first

**Files**: `/apps/www/src/store/`, hooks that also use TanStack Query

**Problem**: Server state appears in both Zustand store and TanStack Query cache simultaneously. Two sources of truth for the same data. Callers must know which to read from.

**Solution**: Hard seam — TanStack Query owns all server state. Zustand owns only UI/ephemeral state (player queue, modal open state). Remove server data from the store.

**Benefits**: No cache invalidation bugs from dual-write. Clear interface: "is this server data? use the query hook. is this UI state? use the store."

---

## Status

| # | Title | Status |
|---|-------|--------|
| 1 | Error handler pass-through | backlog |
| 2 | Music entity shallow copies | backlog |
| 3 | Music link scraper no seam | backlog |
| 4 | Mix processing filesystem coupling | deprecated |
| 5 | Frontend store/query dual state | **in progress** |
