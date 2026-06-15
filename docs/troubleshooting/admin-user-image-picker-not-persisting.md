# Admin User Image Picker Not Persisting

Date: 2026-06-16

## Symptom

In `/admin/users`, editing a user and choosing an image from the S3 media picker appeared to work in the modal, but saving the user did not persist the selected profile image.

The picker showed the correct object from the production user content bucket, and the preview updated locally, but after saving and reloading the user list the old image remained.

## Root Cause

The S3 media picker was not the broken part. It returned a canonical CDN URL from `bucketRouterUrl`, for example `https://cdn.goosebumps.fm/user-content/...`.

The bug was in the persistence path:

1. The admin user editor stored the picked URL in `editUser.image`.
2. Save sent `image` through `authClient.admin.updateUser`.
3. The app-owned user profile route that the editor also called only persisted `bio`.
4. The self-profile JSON route declared `image` in its schema, but ignored `body.image` in the handler.

This meant the UI could select an image, but the app's own `user.image` update path did not reliably write the selected URL.

## Fix

Persist user images through the app-owned user service instead of relying on Better Auth admin updates for this app-specific profile field.

Changed files:

- `apps/www/src/routes/admin/_components/-UsersTab.tsx`
- `apps/vps/src/routes/user/user.routes.ts`
- `apps/vps/src/routes/user/user.handlers.ts`
- `apps/vps/src/services/user.service.ts`

Behavior after the fix:

- Admin user save sends `image` to `/api/user/admin/:userId/bio` alongside `bio`.
- The admin patch route accepts optional `image` and persists it through `UserService.updateUserProfile`.
- The self-profile JSON update path also applies `body.image` when present.
- `image` and `bio` can be set to `null` so removing an image or bio can persist cleanly.

## Verification

Run:

```bash
bun precommit
```

Expected result:

- `oxfmt` passes.
- `oxlint` passes.
- `tsgo --noEmit` passes.
- Package typechecks pass for `@gbfm/vps`, `@gbfm/www`, `@gbfm/ui`, and the other workspace packages.

Manual check:

1. Open `/admin/users`.
2. Edit a user.
3. Pick an image from the bucket picker.
4. Save changes.
5. Reload the users table or profile page.
6. Confirm the new `user.image` URL persists and renders.

## Regression Risk

This fix keeps Better Auth responsible for Better Auth fields like `name`, `email`, `username`, and `emailVerified`.

The app-owned profile fields should stay on app-owned routes backed by `UserService`, especially `image`, `bio`, and social links.
