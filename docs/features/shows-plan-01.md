# Shows/Residencies Feature Implementation Plan

## Overview

Add a "Shows" feature for recurring DJ residencies. Shows have multiple hosts, episodes (reusing the `audio` table), and user subscriptions. URL structure: `/shows/[show-slug]/[episode-slug]`

---

## Database Schema Changes

### 1. New File: `apps/vps/src/db/show.schema.ts`

**`shows` table:**
- Uses `defaultContentFields` (id, title, description, thumbnailUrl, slug, content, draft, tags, createdAt, updatedAt)
- Additional fields: `scheduleDescription`, `website`, `instagram`, `soundcloud`, `mixcloud`, `genres[]`

**`show_creators` junction table:**
- `showId` (UUID, FK → shows)
- `creatorId` (text, FK → users)
- Composite primary key

**`show_subscriptions` table:**
- `id`, `userId`, `showId`, `createdAt`
- Unique constraint on (userId, showId)

### 2. Modify: `apps/vps/src/db/audio.schema.ts`

Add to `audioTable`:
- `showId: uuid('show_id').references(() => showsTable.id, { onDelete: 'set null' })`
- `episodeNumber: integer('episode_number')`
- Index on `showId`

### 3. Migration

Run `bun db:gen` and `bun db:migrate` after schema changes.

---

## Backend (apps/vps)

### Services

| File | Purpose |
|------|---------|
| `src/services/show.service.ts` | CRUD for shows, getEpisodes, MDX compilation |
| `src/services/show-subscription.service.ts` | subscribe, unsubscribe, getStatus |

Follow `LabelService` pattern with Effect layers.

### API Endpoints

**Content Routes** (`/content/shows`):
| Method | Path | Description |
|--------|------|-------------|
| GET | `/content/shows` | List all shows (paginated) |
| GET | `/content/shows/{slug}` | Get show by slug with compiled MDX |
| GET | `/content/shows/{slug}/episodes` | Get episodes for show (paginated) |
| POST | `/content/shows` | Create show (admin) |

**Subscription Routes** (`/shows`):
| Method | Path | Description |
|--------|------|-------------|
| POST | `/shows/{showId}/subscribe` | Subscribe (auth required) |
| DELETE | `/shows/{showId}/subscribe` | Unsubscribe (auth required) |
| GET | `/shows/{showId}/subscription-status` | Check if subscribed |

### Files to Create/Modify

```
src/db/show.schema.ts                    # NEW
src/db/audio.schema.ts                   # MODIFY - add showId
src/db/index.ts                          # MODIFY - export show schema
src/services/show.service.ts             # NEW
src/services/show-subscription.service.ts # NEW
src/routes/content/show.routes.ts        # NEW
src/routes/content/show.handlers.ts      # NEW
src/routes/content/content.index.ts      # MODIFY - mount show routes
src/routes/shows/shows.index.ts          # NEW
src/routes/shows/subscription.routes.ts  # NEW
src/routes/shows/subscription.handlers.ts # NEW
src/app.ts                               # MODIFY - mount /shows routes
```

---

## Frontend (apps/www)

### Routes

| File | Purpose |
|------|---------|
| `src/routes/shows/$showSlug.tsx` | Show detail page with hero + episode grid |
| `src/routes/shows/$showSlug/$episodeSlug.tsx` | Episode detail (optional, can link to existing mix page) |

### Components

Create in `src/components/shows/`:

| Component | Purpose |
|-----------|---------|
| `ShowHero.tsx` | Artwork, title, description, subscribe CTA, play latest CTA |
| `EpisodeGrid.tsx` | Grid of episodes with pagination |
| `EpisodeCard.tsx` | Single episode card with play button |
| `ShowAboutSection.tsx` | MDX bio, social links |
| `SubscribeButton.tsx` | Handles auth state, subscribe/unsubscribe |

### Data Fetching (`src/lib/http.ts`)

Add hooks:
- `useAllShows()` - infinite query
- `useShowBySlug(slug)` - single show query
- `useShowEpisodes(showSlug)` - infinite query for episodes
- `useSubscriptionStatus(showId)` - check subscription
- `useSubscribeToShow()` - mutation
- `useUnsubscribeFromShow()` - mutation

### Subscription UX

**Logged-in user:** Click subscribe → immediate subscription → toast confirmation

**Anonymous user:** Click subscribe → toast with sign-up CTA → redirect to `/auth/sign-up`

---

## Implementation Order

### Phase 1: Database
1. Create `show.schema.ts` with tables, relations, Zod schemas
2. Modify `audio.schema.ts` to add `showId`, `episodeNumber`
3. Export from `db/index.ts`
4. Generate and run migration

### Phase 2: Backend Services
1. Create `show.service.ts` (Effect pattern)
2. Create `show-subscription.service.ts`
3. Register in runtime layer

### Phase 3: API Routes
1. Create show routes + handlers under `/content/shows`
2. Create subscription routes + handlers under `/shows`
3. Mount in `content.index.ts` and `app.ts`

### Phase 4: Frontend Data Layer
1. Add query hooks to `http.ts`

### Phase 5: Frontend UI
1. Create `shows/$showSlug.tsx` route with loader
2. Create ShowHero, EpisodeGrid, EpisodeCard components
3. Create ShowAboutSection component
4. Create SubscribeButton with auth handling

### Phase 6: Polish
1. SEO meta tags via route `head` function
2. Loading states, error handling
3. Test audio player integration
4. Test subscription flow

---

## Key Reference Files

- `apps/vps/src/db/label.schema.ts` - schema pattern with creators junction
- `apps/vps/src/services/label.service.ts` - Effect service pattern
- `apps/vps/src/routes/content/label.routes.ts` - OpenAPI route pattern
- `apps/www/src/routes/labels/$labelSlug.tsx` - detail page pattern
- `apps/www/src/lib/http.ts` - query hooks pattern
- `apps/www/src/store/audioPlayer.ts` - player integration

---

## Verification

1. **Database:** Run migration, verify tables in Drizzle Studio (`bun db:studio`)
2. **API:** Test endpoints via Bruno or curl
3. **Frontend:** Navigate to `/shows/[test-slug]`, verify:
   - Show data loads and renders
   - Episodes display in grid
   - Play button triggers audio player
   - Subscribe button works (logged-in vs anonymous)
4. **E2E:** Create show → add episodes → subscribe → verify notification preferences
