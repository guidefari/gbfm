# Plan: Admin User Invite Flow

## Context

As admin, you want to pre-create user accounts and send them a personalised invite email with a link that lets them set their own password. This avoids the admin needing to share passwords out-of-band and gives invited users a clean first-run experience. There is no existing invite/token system — this is greenfield work that integrates with Better Auth, the existing email infrastructure, and the admin dashboard.

---

## Chosen Approach

**Pre-create the account + send an invite that is effectively a password-reset link.**

Better Auth already has a `sendResetPassword` hook and `/auth/reset-password` page. The invite flow reuses that exact mechanism:

1. Admin creates the user (with a random throw-away password) via `authClient.admin.createUser`.
2. Immediately after, the frontend calls a new VPS endpoint `POST /invite/send` which:
   - Calls `auth.api.requestPasswordReset` internally (Better Auth generates the token and stores it in the `verification` table) to get the reset URL.
   - Sends a custom **invite email** (not the generic password-reset template) with the reset URL.
   - Creates an email delivery log entry.
3. The user clicks the link → lands on the existing `/auth/reset-password` page → sets password → done.

This means **no new DB table is needed** — Better Auth's `verification` table already handles the token with a 7-day expiry (we can pass `expiresIn` to BetterAuth's reset API). The only new state is the email delivery log row.

---

## Files to Create / Modify

### 1. `packages/email/emails/invite.tsx` _(new)_

React Email template for the invite. Props: `name`, `inviteUrl`, `role`, `expiresIn` (default `"7 days"`).
Subject: `"You've been invited to goosebumps.fm"`

### 2. `packages/email/src/sender.ts` _(modify)_

Add `sendInviteEmail({ to, name, inviteUrl, role, expiresIn })` helper following the pattern of `sendPasswordResetEmail`.

### 3. `packages/email/src/index.ts` _(modify)_

Export `InviteEmail` and `sendInviteEmail`.

### 4. `apps/vps/src/routes/invite/invite.routes.ts` _(new)_

OpenAPI route spec for `POST /invite/send`:

```
body: { userId: string }
response 200: { success: boolean, emailId: string }
response 401: unauthorized (not admin)
response 404: user not found
response 500: failed to send
```

Protected by `betterAuthMiddleware`. Handler checks `c.get('user').role === 'admin'` and returns 401 if not.

### 5. `apps/vps/src/routes/invite/invite.handlers.ts` _(new)_

Handler logic:

- Look up user by `userId` from the DB.
- Call `auth.api.requestPasswordReset({ body: { email: user.email, redirectTo: `${config.urls.frontend}/auth/reset-password` } })` to generate the token internally (Better Auth stores it in `verification` table with the expiry).
- Reconstruct the reset URL from the token (Better Auth returns it in the response or we can use the `sendResetPassword` callback trick).
- Create email delivery log (PENDING).
- Call `sendInviteEmail(...)`.
- Mark log as SENT / FAILED.
- Return `{ success, emailId }`.

> **Note on token generation**: Better Auth's `requestPasswordReset` is designed to call `sendResetPassword` callback. We can either (a) call the endpoint internally and intercept in the callback, or (b) directly generate & insert a verification token manually (simpler). Option (b): generate a UUID token, insert into `verificationTable` with `identifier = user.email`, `value = <token>`, `expiresAt = now + 7 days`, and compose the URL as `${frontend}/auth/reset-password?token=<token>`.

### 6. `apps/vps/src/routes/invite/invite.index.ts` _(new)_

Wire route to handler via `createRouter().openapi(...)`.

### 7. `apps/vps/src/app.ts` (or wherever routes are mounted) _(modify)_

Mount `/invite` router.

### 8. `apps/www/src/routes/admin/_components/UsersTab.tsx` _(modify)_

- After `createUserMutation` succeeds, automatically call `POST /invite/send` with the new user's `id` (auto-invite on creation).
- Add a standalone **"Send Invite"** button on every user row — works for both newly-created and pre-existing users in the DB.
- Show toast on invite success/failure.
- The invite endpoint is admin-only on the backend, so no additional frontend guard is needed beyond the existing admin dashboard check.

---

## Key Reused Patterns & Utilities

| What                                                  | Where                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Email delivery log creation/update                    | `apps/vps/src/repositories/email-delivery-log.repository.ts` |
| `EMAIL_DELIVERY_STATUSES`, `EMAIL_NOTIFICATION_TYPES` | `apps/vps/src/db/email.schema.ts`                            |
| `betterAuthMiddleware`                                | `apps/vps/src/middlewares/better-auth.middleware.ts`         |
| `createRouter()`                                      | `apps/vps/src/lib/create-app.ts`                             |
| `config.urls.frontend`                                | `apps/vps/src/services/config.service.ts`                    |
| `sendEmail()` + React Email render pattern            | `packages/email/src/sender.ts`                               |
| `verification` table (for token storage)              | `apps/vps/src/db/auth.schema.ts`                             |
| `authClient` (frontend)                               | `apps/www/src/lib/auth-client.ts`                            |
| `AppRouteHandler` type                                | `apps/vps/src/lib/types.ts`                                  |

---

## Verification

1. In admin dashboard, create a new user (name, email, role).
2. Invite is sent automatically after creation → check toast + email delivery logs table.
3. Open invite email → click link → should land on `/auth/reset-password` with token pre-filled.
4. Set a password → verify you can sign in.
5. Test "Resend Invite" button on an existing user row.
6. Verify 7-day token expiry by checking `verification` table `expiresAt`.
7. Verify email delivery log row transitions PENDING → SENT.
