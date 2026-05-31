# User Social Links + Bio Implementation Plan

## Goal

Implement ordered user social links with a relational model (non-JSONB), add user bio support, and expose both in public/authenticated profile APIs.

## Decisions

- Social links stored in `user_social_links` table.
- `bio` stored on Better Auth `user` table.
- Allowed platforms: `bandcamp`, `substack`, `soundcloud`, `instagram`, `twitter`, `tiktok`.
- Ordered links via per-user `position`.
- Duplicate platforms allowed.

## TODO

- [x] Extend `apps/vps/src/db/auth.schema.ts`:
  - [x] Add `bio` on `user`
  - [x] Add `user_social_links` table + relations + platform schemas/types
  - [x] Add bio/social schemas to relevant user/profile zod schemas
- [x] Add migration SQL in `apps/vps/drizzle/` for `bio` + `user_social_links` + indexes/constraints
- [x] Update profile public API (`/profile/{username}`) to include `bio` + ordered `socialLinks`
- [x] Update authenticated profile APIs (`/user/profile`) to include/update `bio`
- [x] Add dedicated social-link endpoints:
  - [x] `GET /user/profile/social-links`
  - [x] `PUT /user/profile/social-links`
- [x] Implement service-layer methods for reading/replacing ordered social links
- [x] Update `apps/www/src/lib/http.ts` profile types to include `bio` + `socialLinks`
- [x] Add tests for new social-links + bio schema/route/handler behavior
- [x] Extend Admin Users UI edit dialog with:
  - [x] Bio editing
  - [x] Dedicated social-links tab
  - [x] Drag-and-drop ordering + save
- [x] Add admin-scoped backend endpoints for editing target user bio/social links
- [x] Run typecheck for `apps/vps` and `apps/www`
- [x] Mark completed tasks and summarize
