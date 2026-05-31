# Newsletter Subscribe Flow Audit

## Flow summary

1. User visits `/subscribe`, enters email, submits form
2. `useNewsletterSubscribe()` fires `POST /newsletter/subscribe` with `{ email, source: 'subscribe_page' }`
3. Backend normalizes email (`trim().toLowerCase()`), inserts into `newsletter_subscribers`
4. `onConflictDoNothing` on `email` — silently skips duplicates
5. Returns `{ subscribed: true/false, email }` — UI shows appropriate confirmation

## Key files

| Layer     | File                                                    |
| --------- | ------------------------------------------------------- |
| Page      | `apps/www/src/routes/subscribe.tsx`                     |
| HTTP hook | `apps/www/src/lib/http.ts` — `useNewsletterSubscribe`   |
| Route def | `apps/vps/src/routes/newsletter/newsletter.routes.ts`   |
| Handler   | `apps/vps/src/routes/newsletter/newsletter.handlers.ts` |
| Schema    | `apps/vps/src/db/newsletter.schema.ts`                  |

## Gaps identified & resolution

### 1. No rate limiting

**Problem:** The subscribe endpoint had no rate limiting — anyone could hammer it with arbitrary emails.

**Fix:** Applied `strictRateLimiter()` (10 req/min per IP) to the newsletter router in `newsletter.index.ts`. Existing `rateLimiter` middleware already existed in the codebase.

### 2. No welcome/confirmation email

**Problem:** Successful new subscriptions produced no outbound email. Subscriber had no confirmation their address was recorded.

**Fix:** Added a `NewsletterWelcomeEmail` template (`packages/email/emails/newsletter-welcome.tsx`) and a `sendNewsletterWelcomeEmail` sender function. Handler now fires the welcome email fire-and-forget on `subscribed: true` — failure is logged but does not affect the HTTP response.

### 3. No unsubscribe mechanism

**Problem:** `newsletter_subscribers` had no unsubscribe token, and there was no unsubscribe route. Any future bulk send would have no opt-out link, violating CAN-SPAM/GDPR baseline requirements.

**Fix:**

- Added `unsubscribeToken uuid unique` column to `newsletter_subscribers` schema (auto-generated on insert)
- Added `unsubscribedAt` timestamp column (soft-delete approach, preserves the record)
- Added `POST /newsletter/unsubscribe` route accepting `{ token }` — sets `unsubscribedAt`, no auth required
- Unsubscribe token included in the welcome email footer

### 4. No filtering of already-unsubscribed on future sends

Not implemented yet — no bulk-send pipeline exists. When that's built, filter `WHERE unsubscribed_at IS NULL`.

## Schema (after changes)

```
newsletter_subscribers
  id                uuid PK
  email             varchar(255) unique not null
  source            varchar(50)
  unsubscribe_token uuid unique (auto-generated)
  unsubscribed_at   timestamptz nullable
  created_at        timestamptz
  updated_at        timestamptz
```
