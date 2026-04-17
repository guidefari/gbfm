# Admin Overview Plan

## Goal

Build a separate admin-only overview page at `/admin/overview` that gives a fast read on product health, content health, and operations.

## Scope

- Add a VPS summary endpoint for admin overview data
- Add a frontend route in `apps/www` for `/admin/overview`
- Keep the existing `/admin/` management tabs intact
- Link the new overview page from the existing admin area

## Initial Dashboard Sections

- Headline KPIs
  - users
  - verified users
  - newsletter subscribers
  - total plays
- Publishing pulse
  - mixes, tracks, shows, posts, micros, labels, releases
  - drafts vs published where applicable
  - last 7 day creation counts
- Recent activity
  - newest content across major content types
  - newest users
  - newest newsletter signups
- Operational health
  - email delivery status breakdown
  - recent failed emails
  - active sessions
  - pending and failed reminders
- Engagement signals
  - favorites total
  - show subscriptions total
  - top mixes by play count

## Data Sources

- `user`
- `session`
- `audio`
- `shows`
- `show_subscriptions`
- `posts`
- `labels`
- `releases`
- `favorites`
- `newsletter_subscribers`
- `email_delivery_logs`
- `music_reminder`

## Build Order

1. Define response schema for the overview endpoint
2. Implement VPS route + handler + data aggregation
3. Add client hook in `apps/www/src/lib/http.ts`
4. Build `/admin/overview` page UI
5. Add navigation from `/admin/`
6. Validate with `bun precommit`

## Notes

- Start read-only and aggregation-focused
- Prefer compact panels over charts unless the data clearly benefits from charting
- Use 7 day and 30 day windows for simple trend context
