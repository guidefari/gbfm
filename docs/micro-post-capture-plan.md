# Micro-Post Capture CMS — Session Handoff

## Goal

Improve CMS experience in `apps/www` for capturing tweet-style micro-posts. Each post = a shared piece of media (song / album / playlist / video / etc) from one of many platforms, plus commentary. Optimize for **speed of capture** so the act of sharing is frictionless.

## User Prompts (verbatim intent)

### Prompt 1 — kickoff

> I want to improve on the cms experience for capturing a tweet in `@apps/www/` - I think for now it's okay to have a completely standalone page for it, while we hone in the design. we may also need to extend the data model in `@apps/vps/src/db/post.schema.ts` - ultimately I have a song to share, or album, playlist, etc. from many different platforms, and also usually have commentary to go along with that thing I'm sharing. how can we present this in an intuitive and quick way for the person capturing?

### Prompt 2 — direction chosen

> yeah let's do the json embed. spotify, youtube, bandcamp, apple music. but also, I want to reuse the music service to capture metadata from one link.

### Prompt 3 — planning method

> use the grill me with docs skill for us to plan this out.

(Skill not loading in this session — defer to new session.)

## Decisions

- **Standalone admin page** while design is iterated on. Keep separate from existing editor (`apps/www/src/components/editor.tsx`, `simple-markdown-editor.tsx`).
- **Reuse `micro` post type** already in `postTypeEnum` (`apps/vps/src/db/post.schema.ts:18`).
- **Use existing music tables** instead of a new canonical wrapper table. Reuse `music_albums`, `music_tracks`, `music_playlists`, and `music_entity_links`.
- **Single music entity per tweet** for v1. No join table, no ordering, no overrides.
- **Polymorphic post reference** on `posts`: `musicEntityType` + `musicEntityId`.
- **Standalone tweets remain valid** when no music entity is attached.
- **Platforms (v1):** Spotify, YouTube, Bandcamp, Apple Music.
- **Reuse existing music services** in `apps/vps/src/services/` for metadata extraction and entity sync:
  - `spotify.service.ts`
  - `bandcamp.service.ts`
  - `music-link-scraper.service.ts`
  - `url-utils.ts`
  - `resolve.service.ts`
  - Possibly `music-entity.service.ts`
- **Cover art sync lives in `apps/vps`** and copies into our buckets as a best-effort step.
- **No raw scrape payload** in persisted data.
- **Manual resync/edit later** is supported by refreshing the existing entity in place.

## Data Model Sketch

Extend `postsTable` in `apps/vps/src/db/post.schema.ts`:

```ts
musicEntityType: text('music_entity_type').nullable()
musicEntityId: uuid('music_entity_id').nullable()
```

Update zod schemas:

- `selectPostSchema` — add `musicEntityType`, `musicEntityId`
- `insertPostSchema` / `updatePostSchema` — add optional `musicEntityType`, `musicEntityId`

Migration: add nullable polymorphic reference fields. No backfill needed for the first pass.

## Capture UX Sketch

Route: `/admin/capture` (or similar) in `apps/www`.

Flow:

1. Big paste box at top — single input.
2. On paste/blur: detect platform via host regex → call `apps/vps` endpoint → resolves or creates the matching music entity.
3. Preview card renders below paste box (thumbnail, title, artist, platform badges/links from entity links).
4. Commentary textarea below preview. Markdown supported, no toolbar fluff.
5. Optional: title field (auto-suggested from the entity).
6. Submit → creates `micro` post, optionally linked to the resolved music entity.
7. Keyboard: `Cmd+Enter` submit, `Esc` clear.

Slug auto-gen: first embed title + short hash, or timestamp.

## API Endpoints Needed

- `POST /api/music/resolve` — body `{ url }` → returns the resolved music entity + linked platform URLs + cover image URL.
- Existing post create/update routes need to accept `musicEntityType` and `musicEntityId`.
- Existing music entity endpoints should keep their current contract.

## Open Questions for Next Session

1. Which existing route should host the resolver endpoint: a new music route or an extension of the current Spotify route?
2. Should a post link to the music entity by ID only, or also persist the entity type explicitly for simpler queries?
3. What is the minimum migration path for existing content that can safely attach music entities without changing post semantics?
4. How should the post renderer present a linked music entity in the current micro-post UI?

## Execution Tracker

- [x] Decide capture scope and storage model
- [x] Confirm no new canonical wrapper table
- [x] Keep `micro` posts standalone when needed
- [x] Update `apps/vps` schemas and service contracts
- [x] Add resolver/sync endpoint in `apps/vps`
- [x] Add or update `apps/www` capture page
- [ ] Add migration/backfill for attachable existing content
- [x] Verify all current content endpoints still work
- [x] Run `bun precommit`

## Files Touched in This Session (Uncommitted Before Session)

These were already modified — unrelated to this work, do not bundle:

```
M apps/www/src/components/Layout/DesktopSideNav.tsx
M apps/www/src/components/Layout/NavLinks.tsx
M apps/www/src/components/editor.tsx
M apps/www/src/components/simple-markdown-editor.tsx
M apps/www/src/routes/admin/_components/-ContentTab.tsx
?? apps/www/src/components/react-mde.ts
```

## Suggested Next Session Kickoff

1. Update `apps/vps/src/db/post.schema.ts` with the new polymorphic reference fields.
2. Extend `apps/vps/src/services/music-entity.service.ts` or add a dedicated resolver wrapper.
3. Add the resolver route in `apps/vps`.
4. Wire the capture UI in `apps/www`.
5. Backfill where possible and verify existing content routes.
