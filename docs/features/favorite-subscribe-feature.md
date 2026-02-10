# Favorite/Subscribe Feature for Mixes & Shows

## Overview

Add the ability to favorite mixes and shows, with a combined favorite+subscribe action for shows. Works for both authenticated and first-time users via an inline auth prompt.

## Current State

**What exists:**
- `SubscribeButton` component for shows - redirects to sign-in for unauthenticated users
- Favorites API: Full backend support for favoriting both audio (mixes) and shows
- Frontend hooks: `useFavorites`, `useAddFavorite`, `useRemoveFavorite` (audio only)
- Auth flow: Toast notification + redirect to `/auth/sign-in`

**Gaps:**
- Mix page has no favorite button
- No "favorite show" frontend implementation (only subscribe)
- Current UX for unauthenticated users is disruptive (immediate redirect)

## UX Flow

### Logged-in Users

| Content | Action | Behavior |
|---------|--------|----------|
| **Mix** | Favorite | Toggle heart, toast feedback |
| **Show** | Favorite | Toggle heart + auto-subscribe to notifications |

### First-time / Unauthenticated Users

Progressive disclosure pattern instead of immediate redirect:

1. Click favorite → Show inline dialog (not page redirect)
2. Dialog offers: **Sign in** (primary) / **Create account** (secondary) / **Dismiss**
3. After successful auth → auto-complete the original favorite action

## Implementation

### Components to Create

#### 1. `FavoriteButton.tsx`

Reusable heart button component.

**Location:** `apps/www/src/components/FavoriteButton.tsx`

**Props:**
```typescript
interface FavoriteButtonProps {
  contentType: 'mix' | 'show'
  contentId: string
  contentTitle: string
}
```

**Behavior:**
- Uses `useFavorites()` to check if already favorited
- For shows: calls both favorite + subscribe endpoints
- Handles loading/optimistic states
- Triggers auth dialog for unauthenticated users

#### 2. `AuthPromptDialog.tsx`

Inline auth prompt modal.

**Location:** `apps/www/src/components/AuthPromptDialog.tsx`

**Features:**
- Modal overlay (not page redirect)
- "Sign in to save favorites" messaging
- Sign in / Create account buttons
- Stores pending action in localStorage
- After successful auth, executes the pending action

#### 3. `usePendingAction` hook

Stores action to complete after auth.

**Location:** `apps/www/src/hooks/usePendingAction.ts`

**Features:**
- Persists to localStorage (survives auth redirect if user chooses that path)
- Clears after execution
- Shape: `{ type: 'favorite', contentType: 'mix' | 'show', contentId: string }`

### HTTP Hooks to Add

Add to `apps/www/src/lib/http.ts`:

```typescript
useAddShowFavorite()    // POST /favorites { showId }
useRemoveShowFavorite() // Need to verify endpoint exists
```

### Page Changes

#### `$mixId.tsx`

Add `FavoriteButton` to the action bar alongside ShareButton:

```tsx
<div className='flex flex-shrink-0 gap-2'>
  <ShareButton type='mix' slug={mix.slug} />
  <FavoriteButton contentType="mix" contentId={mix.id} contentTitle={mix.title} />
  {/* existing QR and Edit buttons */}
</div>
```

#### `$showSlug.tsx`

Replace `SubscribeButton` with combined `FavoriteButton`:

```tsx
<div className='flex gap-2'>
  <FavoriteButton contentType="show" contentId={data.id} contentTitle={data.title} />
  <ShareButton type='show' slug={showSlug} />
</div>
```

## Visual Design

- Icon: `Heart` from lucide-react
- Filled heart (red/primary) when favorited
- Outline heart when not favorited
- Loading spinner during mutation
- Same sizing as existing ShareButton

## Technical Notes

### Backend Endpoints (Already Exist)

- `POST /favorites` with `{ audioId }` or `{ showId }`
- `DELETE /favorites/:audioId`
- `GET /favorites` - returns user's favorites
- `POST /shows/:showId/subscribe`
- `DELETE /shows/:showId/unsubscribe`

### Database Schema

`favorites` table already supports both audio and shows:
- `audioId` (nullable) - for mixes
- `showId` (nullable) - for shows
- Unique constraints on `(userId, audioId)` and `(userId, showId)`

## Files to Modify

- [ ] `apps/www/src/components/FavoriteButton.tsx` (new)
- [ ] `apps/www/src/components/AuthPromptDialog.tsx` (new)
- [ ] `apps/www/src/hooks/usePendingAction.ts` (new)
- [ ] `apps/www/src/lib/http.ts` - add show favorite hooks
- [ ] `apps/www/src/routes/mixes/$mixId.tsx` - integrate FavoriteButton
- [ ] `apps/www/src/routes/shows/$showSlug.tsx` - replace SubscribeButton with FavoriteButton
