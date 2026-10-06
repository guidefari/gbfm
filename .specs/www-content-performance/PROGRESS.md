# WWW content performance: Progress

## Status: Implemented and locally validated

- [ ] Layer 0: Problem frame (drafted)
- [ ] Layer 1: Shape (drafted)
- [ ] Layer 2: Alternatives
- [ ] Layer 3: Contracts
- [ ] Layer 4: Flows
- [ ] Layer 5: File map
- [ ] Layer 6: Test plan
- [ ] Plannotator review

## Log
- 2026-10-04: Drafted problem frame from the local request trace and current loaders. Awaiting feedback before expanding the design.
- 2026-10-04: User requested architectural options and finer tracing. Drafted shape; added targeted API spans and verified anonymous trace ingestion. Authenticated reproduction remains outstanding.
- 2026-10-04: Inspected two signed-in requests after instrumentation. Repeated identity and content reads dominated the fresh 2.4-second traces; rendering took about 5 ms. User approved the API-owned page read and atomic commits.
- 2026-10-04: Added `/api/content/audio/:type/:slug/page`, then switched WWW mix and track detail loading to it. Existing resource endpoints remain unchanged. No deployment, production migration, or production data write was performed.

## Delivered behavior

- The API resolves identity once when credentials are present and loads authorized audio once.
- Public metadata uses the loaded audio without another content read. Drafts do not receive public audio metadata.
- Favorite membership uses a bounded user/audio query, not a paginated collection scan. Anonymous pages skip it.
- Session refresh cookies reach the page response. API and WWW responses use `private, no-store`.
- Audio, identity, favorite state and metadata arrive together for SSR and client navigation.
- Missing audio maps to WWW 404; audio database failures map to 503. Optional favorite or metadata failures do not prevent content rendering. Interruption remains interruption.

## Validation

- `bun precommit`: formatting, lint and all workspace typechecks passed.
- Server `bun run test`: 509 unit/integration tests and 111 D1 tests passed, 620 total.
- WWW `bun run unit`: 125 tests passed.
- API contracts: 30 tests passed. Site metadata: 5 tests passed. Social cards: 4 tests passed.
- WWW `bun run build`: client and SSR builds passed; Vite still warns about the large client chunk.
- Initial focused audio/public-action browser run: 14 passed across Mobile Safari and Chrome.
- Full browser run: 100 passed, 31 failed, 1 skipped. This is not a green full-suite result.
- One new test failure assumed the shared listener had no favorite after other tests mutated it. Replaced that account with a unique disposable signup. All 24 audio-detail browser cases then passed with two workers and three repetitions per browser.
- HTTP tests cover public projection parity, draft access, user-scoped favorites, expired/invalid/revoked sessions, untrusted identity headers, cookie renewal and absence of session tokens, email or persistence-only fields.
- Service tests cover optional dependency failures, interruption, one content read, anonymous membership omission and membership beyond 100 favorites.

### Wider browser failures left unchanged

The full run also failed on missing Privacy, Player, Integrations, Dashboard navigation, Content tags, Menu-role and upload selectors. Other failures involved a Vite overlay blocking account-menu clicks, an admin cleanup timeout, an invitation link blocked by overlapping UI, lost unsaved playlist description, and playback/favorite state in the public-action flow. These areas were not changed as part of this task. No pre-change full-suite baseline was run, so not all failures can be labelled pre-existing.

Full output and screenshots/videos are outside git under the session shell output and the temporary `audio-page-e2e-all` directory. The full run was not repeated after fixing the new account fixture.

## Performance evidence

- Before: signed-in WWW spans of 2.409 and 2.436 seconds on the original local setup. Three session resolutions cost about 1.27 seconds and duplicate audio/label reads about 878 ms in the latest trace.
- After: anonymous `/mixes/fer-1?__data=1` returned in 469 ms on that setup. Trace `010f2d3db620ce58fd675c9431b3d4f5` has one page API request, one audio query (210 ms), one label read (210 ms), rendering (3 ms), and no separate metadata/favorites-list request.
- Disposable local D1 fixture: five signed-in transition requests returned in 14 to 31 ms, with WWW server timing of 10.4 to 18.6 ms. This different environment does not prove the same speedup for the user's original signed-in request or production.
- Remaining measurement: a fresh signed-in request on the original setup after the change. Production latency is unmeasured.

## Scope

The change covers mix and track detail. Other page loaders retain their current behavior. The earlier numbered spec layers remain drafts, not a completed design-review process.

## 2026-10-05 follow-up

- New signed-in traces confirm one audio page request and one session resolution. Two mix samples took 1.05 and 1.14 seconds; a later mix took 9.36 seconds while two overlapping show pages took 11.96 and 15.93 seconds.
- Forty-eight anonymous probe reads did not reproduce the long spike. A subsequent browser probe found five database-backed WWW 503 responses; two later serial mix reads succeeded again. The failures and the original slow requests are distinct observations, with no proven shared cause.
- No application fix was made without a reproducible cause. Authenticated replay needs an accessible signed-in browser session; trace cookies are redacted.
- Evidence, request IDs, limits and next probes: [Local backend latency investigation](02-latency-investigation.md).

## 2026-10-06 authenticated follow-up

- Installed `2password` and its upstream skill in the user's dotfiles. Resumed local testing with credentials injected into a trusted probe, without printing or persisting passwords or cookies.
- Nineteen authenticated page reads passed, including three rounds of three overlapping requests. Mixes took 1.01 to 1.14 seconds; shows took 1.44 to 1.72 seconds.
- Fresh traces confirm one session/audio/favorite read for mix pages and the six-request episodes-then-subscription path for show pages.
- The original spike and later database failures did not reproduce. Authenticated access is now available; root cause remains unproven. No application change was made.
