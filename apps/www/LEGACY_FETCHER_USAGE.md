# Legacy `fetcher` usage in apps/www

`fetcher` (`apps/www/src/lib/http-client.ts` via `apps/www/src/lib/http.ts`) is the
pre-Effect-migration HTTP helper: plain `fetch` + manual JSON parsing, throws a bare
`Error` with message `HTTP <status>: <body>` on non-2xx.

The newer path is `getApiClient()` (`apps/www/src/lib/api-client.ts`), Effect's
`HttpApiClient` built from the `Api` contract in `packages/api`. Errors from that path
are typed tagged classes (e.g. `HttpApiError.NotFound`), not generic `Error`s.

Both are live in the codebase today — this is not dead code to delete, it's an
incomplete migration. The detail-route loaders have now crossed the migration boundary,
so `apps/www/src/lib/http-errors.ts` only needs to recognize the typed error shape.

## Priority 1 — route loaders (completed)

These detail-page routes now use `getApiClient()`, so `RouteError` receives typed
`HttpApiError.NotFound` failures. The legacy string-matching fallback has been removed
from `isNotFoundError()`.

- [x] `apps/www/src/routes/mixes/$mixId.tsx` — loader, `GET /content/audio/mix/:mixId`
- [x] `apps/www/src/routes/tweet/$slug.tsx` — loader, `GET /content/posts/micro/:slug`
- [x] `apps/www/src/routes/releases/$slug.tsx` — loader, `GET /content/releases/:slug`
- [x] `apps/www/src/routes/editorial/$slug.tsx` — loader, `GET /content/posts/editorials/:slug`
- [x] `apps/www/src/routes/labels/$labelSlug.tsx` — loader, `GET /content/labels/:labelSlug`
- [x] `apps/www/src/routes/tracks/$trackId.tsx` — loader, `GET /content/audio/track/:trackId`
- [x] `apps/www/src/routes/shows/$showSlug.tsx` — loader, `GET /shows/:showSlug`

## Priority 2 — `lib/http.ts` hooks (shared, high fan-out)

Mixed file: most hooks already use `getApiClient()`, but a handful of admin music-entity
hooks and two others still call `fetcher` directly.

- `lib/http.ts:540` — `useResolveMusicEntity`, `POST /music/resolve`
- `lib/http.ts:580` — `useUpdateProfile`, `PATCH /user/profile`
- `lib/http.ts:1797` — `useAdminAlbums`, `GET /music/albums`
- `lib/http.ts:1804` — `useAdminAlbum`, `GET /music/albums/:id`
- `lib/http.ts:1813` — `useUpdateAdminAlbum`, `PATCH /music/albums/:id`
- `lib/http.ts:1827` — `useDeleteAdminAlbum`, `DELETE /music/albums/:id`
- `lib/http.ts:1835` — `useAdminTracks`, `GET /music/tracks`
- `lib/http.ts:1842` — `useAdminTrack`, `GET /music/tracks/:id`
- `lib/http.ts:1851` — `useUpdateAdminTrack`, `PATCH /music/tracks/:id`
- `lib/http.ts:1865` — `useDeleteAdminTrack`, `DELETE /music/tracks/:id`
- `lib/http.ts:1873` — `useAdminEntityLinks`, `GET /music/:entityType/:entityId/links`
- `lib/http.ts:1893` — `useAddAdminEntityLink`, `POST /music/:entityType/:entityId/links`
- `lib/http.ts:1918` — `useUpdateAdminEntityLinkStatus`, `PATCH /music/:entityType/:entityId/links/:linkId`
- `lib/http.ts:1941` — `useDeleteAdminEntityLink`, `DELETE /music/:entityType/:entityId/links/:linkId`

## Priority 3 — components

- `components/editor.tsx:95` — content fetch by id, `GET /content/:id`
- `components/editor.tsx:105` — save, method/endpoint built dynamically
- `components/tweet-export/use-music-entity.ts:48` — music entity by type/id
- `components/tweet-export/use-music-entity.ts:55` — entity links, `GET /music/:type/:id/links?status=verified`
- `components/TweetMusicEntityCard.tsx:56` — music entity by type/id (duplicate of above hook, different component)
- `components/TweetMusicEntityCard.tsx:64` — entity links, `GET /music/:type/:id/links?status=verified`

## Priority 4 — admin routes

- `routes/admin/_components/-ShowsTab.tsx:90` — create show, `POST /shows`
- `routes/admin/_components/-ShowsTab.tsx:121` — update show, `PATCH /shows/:slug`
- `routes/admin/_components/-ShowsTab.tsx:152` — delete show, `DELETE /shows/:slug`
- `routes/admin/_components/-PlaylistEditor.tsx:136` — reorder tracks, `PATCH /music/playlists/:id/tracks/order`
- `routes/admin/_components/-PlaylistEditor.tsx:152` — remove track, `DELETE /music/playlists/:id/tracks/:trackId`
- `routes/admin/_components/-PlaylistEditor.tsx:171` — add track from spotify, `POST /music/playlists/:id/tracks/spotify`
- `routes/admin/_components/-PlaylistEditor.tsx:216` — update playlist, `PATCH /music/playlists/:id`
- `routes/admin/_components/-ContentTab.tsx:792` — update mix, `PATCH /content/audio/mix/:slug`
- `routes/admin/_components/-ContentTab.tsx:835` — update post, `PATCH /content/posts/:slug`

## Priority 5 — misc forms/uploads

- `routes/label-upload.lazy.tsx:137` — label create/update, dynamic endpoint
- `routes/new/-TweetCapturePage.tsx:254` — tweet/post capture submit
- `routes/shows/_components/-ShowMetadataManager.tsx:64` — update show metadata, `PATCH /shows/:slug`
- `routes/mix-upload/-program.ts:118` — mix create/update, dynamic endpoint + method

## Notes for whoever picks this up

- Check `packages/api/src` for the corresponding `HttpApiEndpoint` before migrating each
  call site — some endpoints (e.g. music album/track CRUD) may not be in the `Api`
  contract yet and would need adding there first.
- After migrating, typed errors change shape: `HttpApiError.NotFound` /
  `HttpApiError.BadRequest` etc. instead of generic `Error` with `HTTP <status>:` message.
  Any local error-message string matching at the call site needs updating too.
- Priority 1 is fully migrated and `isNotFoundError()` now recognizes only the typed
  `HttpApiError.NotFound` shape. Priority 2-5 calls do not feed `RouteError`.
