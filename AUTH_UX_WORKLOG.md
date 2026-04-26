# Auth UX Worklog

## Goal

Make the auth pages feel intentional, branded, and cared for without changing authentication behavior.

## Direction

- Introduce a shared auth page shell instead of styling each route independently.
- Keep the GBFM visual language: dark surfaces, pastel green accents, subtle glow, sharp borders.
- Improve hierarchy with better titles, supporting copy, and structured footer links.
- Upgrade the shared auth form so spacing, feedback, and submit states feel deliberate.

## Current Plan

- [x] Create a shared `AuthPageLayout` with branded background and content framing.
- [x] Add a shared auth status/alert treatment for success and error states.
- [x] Refresh `GenericAuthForm` spacing, styling, autocomplete handling, and loading states.
- [x] Move sign-in, sign-up, forgot-password, and reset-password onto the shared layout.
- [x] Validate with `bun precommit`.
- [ ] Do a visual pass and tune spacing/copy after seeing the new screens in-browser.

## Landed

- Added `AuthPageLayout` and `AuthStatusNotice` for a stronger shared auth shell.
- Updated `GenericAuthForm` with better panel styling, field spacing, loading state, autofocus support, helper text, and per-field autocomplete.
- Migrated all four auth routes to the shared shell while preserving route logic and auth behavior.
- Added clearer copy and stronger footer navigation between auth flows.

## Notes

- Keep route logic and redirects untouched.
- Support both form and message-only states for reset-password.
- Favor one shared abstraction for layout over multiple special-case auth components.
