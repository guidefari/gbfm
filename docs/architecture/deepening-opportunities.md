# Architectural Deepening Opportunities

Surfaced via `/improve-codebase-architecture` on 2026-05-23.

---

## 1. `apps/www/src/lib/http.ts` is very shallow

**Files**: `apps/www/src/lib/http.ts`

**Problem**: This Module mixes transport, auth redirect, error reporting, pagination, and a long list of query and mutation hooks. The Interface is wide, but the leverage is low because callers still need to know too much about request shape and failure behaviour.

**Solution**: Split the shared request/error/reporting seam from domain-specific adapters, so the shared Module only owns request execution and cross-cutting failure handling.

**Benefits**: Higher Locality for request policy changes, smaller Interface to learn, and better tests because transport can be covered once while each domain adapter gets focused tests.

---

## 2. `apps/www/src/store/audioPlayer.ts` mixes state with browser adapters

**Files**: `apps/www/src/store/audioPlayer.ts`

**Problem**: This Module mixes player state with `localStorage`, `document` listeners, `navigator.mediaSession`, analytics, and runtime calls. The bug surface is in the orchestration, not the state shape.

**Solution**: Separate the pure player state machine from the browser adapter, so state transitions can be exercised without a DOM.

**Benefits**: Better Locality for playback bugs, higher Leverage for tests, and fewer mocks because the state machine becomes a clean test surface.

---

## 3. `apps/vps/src/routes/user/user.handlers.ts` and `apps/vps/src/services/user.service.ts` span too many concerns

**Files**: `apps/vps/src/routes/user/user.handlers.ts`, `apps/vps/src/services/user.service.ts`

**Problem**: The route file still handles auth checks, multipart parsing, and admin gating, while `UserService` spans profile edits, social links, email preferences, DJ listing, and directory lookup. That’s a broad Interface over several different concerns.

**Solution**: Deepen the user Module by splitting profile editing, social-link management, preferences, and directory lookup into narrower Modules, leaving the route file as a thin adapter.

**Benefits**: Better Locality when one user concern changes, smaller tests per Module, and a clearer Interface for callers and future readers.

---

## 4. `apps/vps/src/services/music-entity/playlist-tracks.service.ts` hides multiple workflows

**Files**: `apps/vps/src/services/music-entity/playlist-tracks.service.ts`, `apps/vps/src/services/music-entity/index.ts`, `apps/vps/src/routes/music/music.handlers.ts`

**Problem**: This Module coordinates playlist-track CRUD, reorder validation, Spotify import, scraper enrichment, and S3 cover copying across DB, network, and storage Seams. The CRUD work and the orchestration work want different depths.

**Solution**: Keep playlist-track CRUD deep, and move import/sync/enrichment into separate orchestration Modules that depend on the CRUD Module.

**Benefits**: Better Locality because failures stay in one workflow, stronger test leverage because CRUD and orchestration can be tested separately, and less cognitive load because the Interface stops hiding multiple workflows in one place.

---

Which of these would you like to explore?
