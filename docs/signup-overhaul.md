# Sign-up UX overhaul + email verification

## Context

Current `/auth/sign-up` works but misses several industry standards: no password rules surfaced, no live username availability check, no email verification, no terms/privacy consent, page-level scroll on overflow. Backend (`better-auth` at `apps/vps/src/lib/auth.ts`) has verification configured but disabled (`requireEmailVerification: false`, `sendOnSignUp: false`) and `sendVerificationEmail` only logs — no template exists. Goal: tighten signup UX, ship a real verification flow (auto-signin + verify banner pattern), and add reusable bits we can drop into reset-password later.

## Decisions locked in

- **Verification**: auto-signin after signup, persistent "verify your email" banner across app until verified.
- **Welcome + verification**: one combined email — welcome copy + verification CTA — replaces existing `welcome.tsx`.
- **Password rules**: min 8 chars, live checklist below field (✓ ticks as user types). Same rule applied to reset-password for consistency.
- **Username availability**: debounced check via better-auth custom plugin endpoint.
- **Name field**: keep, required.
- **Form scroll**: card itself scrolls when content overflows; page does not. Scrollbar hidden.
- **Terms/privacy**: small consent line w/ links. Routes can be stubs for now.
- **Social auth**: out of scope.

## Files to modify / create

### Backend (`apps/vps`)
- `src/lib/auth.ts` — flip `requireEmailVerification: true`, `sendOnSignUp: true`, `autoSignInAfterVerification: true`. Implement `sendVerificationEmail` to call new combined template via existing email-send util. Add custom plugin (or inline endpoint) `checkUsername` that queries user table for `username` (lowercase-normalized to match plugin behavior). Ensure `databaseHooks.user.create.after` no longer sends the standalone welcome email since it's combined now.
- New: lightweight rate limit on the username check endpoint (in-memory token bucket per IP is fine for indie scale; or skip if better-auth's built-in suffices).

### Email (`packages/email`)
- `emails/welcome.tsx` — refactor into combined "Welcome + verify" template. Add `verificationUrl` prop, big CTA button, keep welcome copy. Or create new `welcome-verify.tsx` and delete old one.
- Confirm send path: whatever util fires `welcome.tsx` today must accept the new prop or be replaced by `sendVerificationEmail`.

### Frontend (`apps/www`)

**Sign-up route** — `src/routes/auth/sign-up.tsx`
- After successful signup: don't navigate away. Switch to a "Check your inbox to verify" success state (mirroring the forgot-password pattern we just built — same `MailCheck` icon, resend button w/ 30s cooldown using `authClient.sendVerificationEmail`).
- "User already exists" error: surface inline w/ a "Sign in instead →" link as part of the notice.
- Pass `helperText` to password field (rules summary). Live checklist component renders below the GenericAuthForm or replaces the `helperText` slot.
- Add Terms/Privacy consent line above submit button.

**AuthPageLayout** — `src/components/Auth/AuthPageLayout.tsx`
- Outer container: `max-h-[100dvh]` + flex column. Card section gets `overflow-y-auto` with hidden scrollbar (`scrollbar-hide` Tailwind plugin if present, else inline style: `scrollbar-width:none; &::-webkit-scrollbar{display:none}` via `main.css` utility class — match the `.bg-vinyl-rings` pattern).
- Add `.no-scrollbar` utility in `apps/www/src/styles/main.css` under `@layer utilities`.

**GenericForm** — `src/components/Auth/GenericForm.tsx`
- Extend `FormField` with optional `onChange?: (val: string) => void` and `rightSlot?: ReactNode` (so password show/hide and username availability indicator can live inside the input wrapper).
- Add a `PasswordInput` wrapper — handles show/hide eye toggle. Use lucide `Eye` / `EyeOff` (already a dep).
- Add `belowField?: ReactNode` to `FormField` so the live password checklist mounts in-line under the password input without forking the form.

**New components** — `src/components/Auth/`
- `PasswordChecklist.tsx` — props `{ password: string }`. Single rule for now: `≥ 8 chars`. Renders a tiny list w/ ✓/○ icons, color shifts to `gb-pastel-green-1` when satisfied. Easy to extend later.
- `UsernameAvailability.tsx` — props `{ username: string }`. Debounces 400ms, calls `authClient.checkUsername({ username })` (or whatever the plugin exposes), shows ✓ available / ✗ taken / spinner. No-op for `< 3` chars.

**Reset-password** — `src/routes/auth/reset-password.tsx`
- Wire same `PasswordChecklist` under the new-password field. Enforce min-8 client-side before submit (matches server).

**Verification banner** — new `src/components/Auth/VerifyEmailBanner.tsx`
- Reads current user from `useAuthStore`, shows if `user.emailVerified === false`. Sticky top bar, dismissible-for-session, "Resend verification" button hooks into `authClient.sendVerificationEmail`. Mount in root layout (`src/routes/__root.tsx` or wherever the app shell lives).

**Verify-email callback** — `src/routes/auth/verify-email.tsx`
- Better-auth handles the token verification, but we need the redirect landing page. Show success state ("Email verified, you're all set") and link back home.

**Auth-client** — `src/lib/auth-client.ts`
- Add `usernameClient` plugin call if not present, ensure `checkUsername` is exposed. Add the verify email plugin client side.

**Terms / Privacy stubs** — `src/routes/terms.tsx`, `src/routes/privacy.tsx` (single placeholder paragraph each — content later).

## Reused utilities & patterns

- `AuthPageLayout` props (`title`, `description`, `badge`, `status`, `footer`) — overload existing props for the new "check inbox" state on signup, same pattern as forgot-password.
- `AuthStatusNotice` — reuse for inline errors w/ embedded link.
- `MailCheck` icon from `lucide-react` — already used in forgot-password.
- `.bg-vinyl-rings` utility — no change.
- `useAuthStore` (`src/store/auth.ts`) — read `user` for the verify banner.
- Forgot-password resend cooldown logic (`src/routes/auth/forgot-password.tsx:23-27`) — copy/extract into a small `useCooldown(seconds)` hook in `src/lib/hooks/useCooldown.ts` and reuse in sign-up + verify banner. Worth extracting now since 3 callsites.

## Build order (small, verifiable steps)

1. ✅ Extract `useCooldown` hook from forgot-password, refactor that file to use it. _Landed at `src/lib/useCooldown.ts` (flat, matching project convention)._
2. ✅ Add `.no-scrollbar` utility + apply to AuthPageLayout card. _Utility added; card-internal scroll attempt reverted because it fought the AppShell chrome and made the whole page scrollable. Page scrolls naturally for now; utility kept for future use._
3. ✅ Build `PasswordChecklist`. Wire into sign-up + reset-password. _Exports `isPasswordValid` for submit-gate reuse._
4. ✅ Extend GenericForm with `belowField`, `rightSlot`, `onChange`. Add password show/hide. _Show/hide auto-applied to `type='password'` fields (no separate `PasswordInput` wrapper needed). Also added `submitDisabled` and `beforeSubmit` props._
5. ✅ Build `UsernameAvailability` component, wire into sign-up. _No backend work needed: better-auth's `username` plugin already exposes `authClient.isUsernameAvailable`. Skipped custom `checkUsername` endpoint and rate-limit plan._
6. ✅ Combined welcome+verify email template, swap send path, flip backend flags. _`welcome.tsx` now requires `verificationUrl` (no opt-in / no fallback shape). `sendOnSignUp: true`, `autoSignInAfterVerification: true`, `requireEmailVerification` kept `false` (auto-signin + nag-banner pattern, not block-until-verified). Standalone welcome email removed from `databaseHooks.user.create.after`. `sendVerificationEmail` appends `callbackURL=<frontend>/auth/verify-email` to the better-auth url so the redirect lands on the frontend, not the VPS root._
7. Frontend: signup success state ("check your inbox"), `useCooldown`-backed resend.
8. ⚠️ Partial: `/auth/verify-email` route landed early (needed for step 6 callback to work). `VerifyEmailBanner` still TODO.
9. Inline "Sign in instead" on existing-email error.
10. Terms/privacy stub routes + consent line on signup.

- ALSO NEED TO LOOK INTO Verification. that's not working at the moment, redirect takes us to the backend file.

## Profile preview card (added during step 4)

`ProfilePreviewCard` shown on sign-up desktop aside (`AuthPageLayout` got an `aside?: ReactNode` prop). Avatar from initials, live-updates display name + `@username` as user types. Replaced inline helper text on Display Name / Username fields per user feedback (card explains the concepts, inline hints were redundant).

## Profile field rename (added during step 4)

`name` field relabelled to "Display Name" in sign-up. Username field placeholder simplified.

## Style notes

- No em dashes in user-facing copy (saved as memory feedback).

## Verification

- `bun precommit` clean (typecheck + biome) after every step.
- Manual e2e:
  - Signup w/ new email → see "Check your inbox" state → receive combined email → click link → land on `/auth/verify-email` success → banner disappears.
  - Signup w/ existing email → inline error w/ working "Sign in instead" link.
  - Password field: type < 8 chars → checklist shows ○; type ≥ 8 → ✓; submit blocked client-side until satisfied.
  - Username field: type taken username → ✗ within ~400ms; type fresh one → ✓; <3 chars → no indicator.
  - Resize window to short height → form card scrolls internally, page doesn't, no visible scrollbar.
  - Forgot-password still works (regression — uses `useCooldown` now).
  - Reset-password rejects < 8 char passwords w/ checklist UI.
- Email rendering: preview combined template via `packages/email` dev preview (whatever script that package exposes).
