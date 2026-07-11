# Process notes: Effect HttpApi migration

How PR review/verification has actually been run for this migration
(`docs/migration-effect-http-api.md`). Written down so the discipline
survives a context reset or a different agent picking up step 6+ -- these
are the standing rules, not suggestions to re-derive each time.

## PR shape

- One route group (or one discrete migration step) per PR. Never bundle
  two groups into one PR even if they're the same size -- if group B
  depends on group A's exported schema (e.g. `resolve` reusing
  `profile`'s response schema), stack B's branch on top of A's branch and
  open B's PR against A's branch, not against the shared integration
  branch. Verify the stack with `git merge-base --is-ancestor <base>
  <head>` before calling the PR open -- got the base branch wrong twice
  early in this migration (PRs #150, #152) from skipping this check.
- All step PRs stack into `migration/effect-http-api`, never directly into
  `prod`. That integration branch gets its own PR to `prod` periodically
  once a meaningful chunk has merged.
- Delete the superseded Hono router (`*.routes.ts`, `*.handlers.ts`,
  `*.index.ts`) in the same PR that ports the group, not as later cleanup
  -- dead code left behind gets found by adversarial review anyway, so
  it's cheaper to just delete it while the group is already in your head.
  Grep for stray imports before deleting (`grep -rln "routes/<group>"`).

## PR description: why not how

The PR body is `## Why` / `## What to look for` / `## Test evidence`, not
a changelog of the diff. The diff already shows what changed; the body's
job is to carry the two things the diff can't: the reasoning a reviewer
would otherwise have to reconstruct, and where to point suspicion.
Concretely:

- `## Why` -- one or two sentences: which step this is, what group, why
  it's the next one to port.
- `## What to look for` -- the non-obvious decisions: a schema
  correctness gotcha, a behavior-change callout (status code changed,
  field added), a library footgun that cost time to find. Written for a
  reviewer who trusts the mechanical parts (typecheck, tests) and needs
  to spend their attention on the parts that could be silently wrong.
  Explicitly reference file paths and line-level reasoning, not vague
  "cleaned things up."
- `## Test evidence` -- see below.

## Test evidence: screenshot when there's a real UI consumer

Rule, stated precisely because it was misapplied once: **skip screenshot
evidence only when there is genuinely no `apps/www` consumer of the
endpoint** (confirmed by grep, not assumed by category). "Backend-only
JSON API port" is not automatically screenshot-exempt -- `search` was
correctly exempt because nothing in `apps/www` called it yet. `profile`
and `resolve` were incorrectly treated the same way on first pass, even
though `/profile/$username` and the `$slug` catch-all page both render
directly from those endpoints. The fix: before writing "no UI surface,"
grep for the endpoint path or the response type name in `apps/www/src`,
not just check whether the group is "backend infrastructure-flavored."

When there is a consumer:

1. Hit the real endpoint on a running dev server first (`curl`), confirm
   the response shape, *then* load the actual frontend page against it
   with `agent-browser` and screenshot. The curl output and the
   screenshot corroborate each other -- a screenshot alone can't prove
   the request that produced it actually succeeded, and a status code
   alone can't prove the UI rendered it correctly.
2. Use real seeded data where possible (a real username, a real show
   slug), not a synthetic fixture -- this project doesn't have seed
   helpers for most tables, so the fastest path is often querying an
   existing read endpoint (e.g. `/api/search`) to find a real id/slug to
   point the screenshot at, rather than writing one-off seed scripts.
3. Upload via the `pr-screenshot-evidence` skill (S3 + CloudFront, one
   image per PR-specific path), embed with a one-line caption plus the
   curl status check as a fenced code block, per the skill's own
   workflow. Don't invent a different hosting path.
4. If a screenshot surfaces mid-review that evidence was skipped
   incorrectly, fix the PR description in place (`gh pr edit`) rather
   than leaving the wrong claim ("no UI surface") sitting in a merged PR
   history.

## Adversarial review after the PR is open

The review runs **after** the PR is created, not before. This way the
reviewer (and you) can see the real diff, the PR description, and the
screenshot evidence while the review is in flight. The sequence is:

1. Commit, push, open the PR with the description + test evidence.
2. Dispatch the adversarial review agent against the open PR's diff.
3. While the review runs, review the PR yourself -- the screenshots and
   curl output are already in the PR body.

The review agent is dispatched as a headless agent with an explicit,
self-contained prompt (the agent has no memory of this conversation -- it
needs file paths, the specific claims to verify, and the specific
commands to run, not "review this PR"). The standing framing: **assume
the implementation is wrong and try to prove it**, not "read the diff and
confirm it looks right."

**One review pass** is the default. Dispatch a second pass (with a
different agent or a different framing) only when the PR touches
middleware, auth, shared schemas used by multiple groups, or any other
complexity that warrants a second pair of eyes. Don't auto-dispatch two
for every PR -- most step-6 mechanical swaps don't need it.

Concretely, every review prompt asks the agent to:
- Re-derive schema/type claims from the real source (service types,
  library type definitions) rather than trusting comments or the PR
  description.
- Actually run the test suite and typecheck, and report real pass/fail
  output -- not assume green because the diff looks clean.
- Check specific named failure modes (date-serialization gaps,
  dead-code leftovers, auth regressions, status-code changes) rather than
  "review generally."
- Report findings that must be fixed, not dismissed -- a finding doesn't
  get argued away in the same turn it's raised; either the code changes
  or there's a concrete reason (stated in the PR, not just in chat) why
  it's not a real issue.

**Known failure mode in this environment: worktree isolation for review
agents has been unreliable** -- three separate dispatches with
`isolation: "worktree"` returned a stale or entirely wrong checkout (an
old release tag, an unrelated branch) instead of the actual branch/commit
under review, even though the commit existed and was pushed. When a
review agent reports it can't find the files described in the task, don't
retry the same isolated dispatch expecting a different result -- that's a
tooling problem, not a flaky agent. The workaround used here: drop
`isolation: "worktree"` and run the review agent directly against the
real repo checkout, with explicit instructions not to `checkout`/
`switch`/`stash`/`reset` anything (since other work may be in flight in
the same tree). This is read-only-safe for a review pass (grep, `git
show`, run tests) as long as the agent is told not to mutate state.

## Things this process has missed (so far)

Documented here instead of only in PR history, since a misapplied rule
that's been silently corrected is easy to repeat:

- **Screenshot exemption applied by category instead of by grep.**
  Covered above -- the actual rule is "no consumer found by grep," not
  "this feels like backend work."
- **Schema drift from the old Hono/zod layer went unnoticed until a port
  forced a field-by-field diff.** Two separate groups (`profile`,
  `resolve`) had response schemas that had quietly stopped matching what
  the service actually returned, and `apps/www` was relying on the
  undeclared fields anyway (Hono doesn't enforce its OpenAPI response
  schema at runtime, so nothing ever caught the drift). This means the
  *old* system had a live but invisible bug for however long the drift
  existed. Worth explicitly diffing old-schema vs. real-service-type vs.
  real-frontend-type on every remaining group, not just trusting the old
  schema was ever correct.
- **Branch staleness after a stacked PR merges.** After PR #156 merged
  into `migration/effect-http-api`, the next step's work-in-progress
  branch (still based on the pre-merge tip) needed an explicit
  `git fetch` + branch reset before branching further, or the new branch
  silently forks from stale history. Check `git merge-base --is-ancestor`
  against `origin/migration/effect-http-api` (not just the local ref)
  before branching the next step.
- **Splitting one working-tree's worth of uncommitted changes into two
  correctly-scoped commits/PRs is manual and error-prone.** When two
  groups were built back-to-back in the same working tree before either
  was committed (profile, then resolve), separating them into two clean
  commits required manually moving new files aside, trimming shared-file
  diffs (`routes.ts`, `app.ts`, `api.ts`, `package.json`) down to one
  group's slice, committing, then restoring the second group's pieces.
  Doable, but slower and riskier than committing group A immediately
  after finishing it, before starting group B -- prefer that ordering
  next time even under a "carry on, don't wait for approval" instruction.
- **A stacked PR merged into a feature branch that never itself got merged
  forward.** PR #158 (`resolve`) merged cleanly into
  `migration/6-profile-group`, exactly per the stacking rule -- but
  `migration/6-profile-group`'s tip (with #158 on it) was never merged into
  `migration/effect-http-api` itself; the integration branch moved on to
  the next steps' docs/client-swap commits instead, so #158 silently never
  made it in even though GitHub shows it as merged. Not caught until a
  later unrelated task needed to check what was live on
  `migration/effect-http-api` and found the old Hono `resolve` files still
  on disk, still wired in `app.ts`. The fix was a clean cherry-pick (PR
  #162), but the actual lesson: after merging PR B (stacked on PR A's
  branch) per the stacking rule, verify PR A's branch tip -- the one B
  actually merged into -- is *also* an ancestor of `migration/effect-http-api`,
  with the same `git merge-base --is-ancestor` check already used for
  branch staleness. Stacking correctly and integrating forward are two
  different steps; doing the first is not evidence the second happened.
- **"Nothing else imports this file" is not the same check as "this type
  is still consumed."** An adversarial review pass on the `admin` PR (#163)
  flagged the old `apps/vps/src/db/admin-overview.schema.ts` (Zod) as fully
  dead and safe to delete, based on a grep showing no remaining *runtime*
  imports from `apps/vps`. It missed that `apps/www/src/routes/admin/-overview.data.ts`
  still imports `AdminOverview`/`AdminOverviewContentBreakdown` as
  **types only** from `@gbfm/vps/schemas` -- a cross-package type import
  that a same-package runtime-usage grep won't surface unless the check
  explicitly greps the consuming app too. The file was correctly left in
  place as a type-only shim (to be retired once a 6b PR points
  `useAdminOverview` at the new `packages/api` schema's inferred type
  instead), but the review's confidence that it was dead was wrong. When a
  review claims a file is orphaned, grep the *other* app/package too, not
  just the one being edited -- and grep for the exported type names, not
  only the schema/const names, since `import type` sites are real
  dependencies that a value-only grep pattern can miss.
- **"HttpApiBuilder.group handlers can't set response headers" is false,
  and was assumed rather than verified against source.** The first version
  of the `invite` group (#164) kept `confirmInvite` as a raw
  `HttpRouter.add` route instead of an `HttpApiEndpoint`, reasoning that
  only middleware wrapping the endpoint's `Effect<HttpServerResponse>`
  can touch headers and the *handler* itself has no header access -- so
  forwarding better-auth's `set-cookie` header needed the raw-router
  escape hatch. Wrong: `effect@4.0.0-beta.93`'s `HttpApiBuilder.ts`
  (`handlerToHttpEffect`) checks `Response.isHttpServerResponse(response)`
  on the handler's own return value and short-circuits schema encoding if
  true, passing a handler-built `HttpServerResponse` straight through --
  the handler can call `HttpServerResponse.json(...)` +
  `HttpServerResponse.setHeader(...)` itself and return that, no
  middleware or raw route required. Caught by adversarial review, fixed in
  the same PR. The generalizable lesson: **when this migration's own docs
  say "X isn't possible with mechanism Y," re-derive that from the pinned
  `effect` source before designing around it** -- a plausible-sounding
  constraint (mirrored, ironically, in this doc's own "Middleware: what
  can touch responses" section, which is about *middleware* wrapping a
  response and never claimed handlers can't return one directly) can still
  be wrong, and an unnecessary architectural exception in one PR becomes a
  false precedent later PRs copy without re-checking.
- **A live-send verification click can hit the wrong target if you don't
  re-confirm state at click time.** While manually verifying `invite`'s
  "Send invite" admin UI action (#164), a stale accessibility-tree ref
  (captured in one snapshot, clicked in a later command after the page had
  already re-rendered from an earlier interaction) caused the click to
  land on a different table row than the one identified. Since this
  particular action sends a real, non-undoable email (a password-reset
  invite) through production SES, the result was a real invite email sent
  to a real, uninvolved user instead of the intended test account --
  caught only by cross-checking the admin Email Logs page's actual
  recipient after the fact, not by trusting the success toast or the
  200 status. **For any endpoint that sends real email, SMS, push, or
  other outbound notification: re-snapshot and re-verify the exact target
  row/field immediately before the click that triggers the send, not
  several commands earlier -- and always cross-check the real delivery
  log afterward instead of trusting a success response alone.** Prefer
  server-log/blackbox-test verification over a live UI click-through
  entirely when the action is non-idempotent and irreversible; if a live
  click is genuinely needed, confirm the exact recipient with the user
  first (as was done here) and re-verify the UI state immediately
  beforehand, not just once earlier in the session.
- **Input-side format validation dropped, twice.** `newsletter` (#165)
  `favorites` (#166), and `file-manager` (#167) all replaced a validated
  zod field (`z.string().email()`, `z.string().uuid()`, `z.string().min(1)`)
  with plain `Schema.String`, silently dropping the constraint. Caught by
  adversarial review three times in a row, despite this doc saying after
  the second one "don't wait for review to catch this a third time" --
  saying so didn't change the actual authoring step, so it happened again.
  **The fix that actually works: run the diff before writing the new
  schema, not after.** Concretely, for every remaining group, the first
  command run when starting the port should be
  `git show migration/effect-http-api:<old-routes-file-path>` (or
  `cat` it) and read every `z.string()` chain for `.email()`/`.uuid()`/
  `.min()`/`.max()`/`.regex()`/enums/refinements *before* opening
  `packages/api/src/<group>.ts` to write the new schema -- not diff
  afterward as a review step. `Schema.NonEmptyString` (see `search.ts`)
  covers `.min(1)`; `Schema.String.pipe(Schema.check(Schema.isPattern(regex)))`
  covers `.email()`/`.uuid()`/`.regex()`. If a step still ships without
  this and review catches it again, that's a process reminder that isn't
  landing -- worth stopping to ask why, not just adding a fourth bullet
  here.
- **A weak validation pattern, once written, gets copy-pasted forward as
  precedent.** `newsletter.ts` (#165) declared its own ad-hoc email regex
  (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) instead of matching zod's real `z.email()`
  behavior -- looser than zod on malformed addresses (`..@x.c`, `a@b..c`
  all pass it, zod rejects them). That pattern was never itself flagged
  (newsletter's review focused elsewhere), and got reused verbatim in
  `user.ts` (#170) for the same field name, where adversarial review finally
  caught it. Fixed in `user.ts` by using zod's actual "practical email"
  regex from `zod/src/v4/core/regexes.ts`, but `newsletter.ts`'s original
  copy is still live and unfixed as of this note -- worth a follow-up PR.
  The generalizable lesson: **when a helper schema (`Email`, `Uuid`,
  `UrlString`, etc.) is copy-pasted into a new group file rather than
  imported from one shared location, its correctness has to be
  re-verified every time, not assumed from the fact that an earlier PR
  used the same regex** -- a bug in a widely-copied pattern compounds
  silently across every group that copied it, and grep for the pattern
  string across `packages/api/src/*.ts` before trusting "this is the
  established pattern" as a reason not to double-check it.
- **Step 6b's `Effect.tapError -> captureException` swap unconditionally
  reports every failure to Sentry, including expected 4xx validation
  errors -- the old `fetcher()` only escalated to Sentry on `>= 500` or
  network errors (`apps/www/src/lib/http-client.ts`'s `res.status >= 500`
  gate), always leaving 4xx as a plain thrown `Error` with no Sentry
  report.** This isn't something a 6b PR introduced -- it was already
  present in step 5's three precedent hooks (`useResolveSlug`,
  `usePublicProfile`, `useAdminArtists`) before this session touched
  anything, and every 6b PR this session correctly followed that existing
  precedent rather than inventing a new, inconsistent pattern. Flagged by
  adversarial review on PR #175 as a real (if minor) observability
  regression: expected client-side validation failures now generate
  Sentry noise they never used to. Worth a small shared wrapper (e.g. a
  `reportClientFailure` helper mirroring `http-client.ts`'s status-based
  gate) applied once across every 6b hook, rather than fixing hooks one
  at a time as they're ported -- fixing it per-PR would just mean some
  hooks match the old gate and others don't, which is its own
  inconsistency.
- **A ported hook can have zero real consumers, and the port itself won't
  surface that.** PR #175's `useUpdateAdminUserBio` was ported faithfully
  from an old `fetcher()`-based hook, but adversarial review found the
  real bio-update UI (`apps/www/src/routes/admin/_components/-UsersTab.tsx`)
  never actually calls this hook -- it makes its own raw `fetcher` PATCH
  call directly, bypassing the hook entirely. This predates the 6b port
  (the hook was already unused under the old `fetcher`-based version
  too), so it's not a regression, but it means "port every hook in the
  file" and "port every hook something actually calls" are different
  scopes, and step 6b's per-group hook inventory should note dead hooks
  the same way step 6's route-level consumer audits already do, instead
  of assuming a hook's existence implies a real caller.
