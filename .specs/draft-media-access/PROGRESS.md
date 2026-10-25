# Draft media access - Progress

## Status: Implementation verified; PR delivery

- [x] Layer 0: Problem frame
- [x] Layer 1: Shape (revised to stable URLs and renewable cookies)
- [ ] Layer 2: Alternatives
- [ ] Layer 3: Contracts
- [ ] Layer 4: Flows
- [ ] Layer 5: File map
- [ ] Layer 6: Test plan
- [ ] Layer 7: PR delivery slices
- [ ] Plannotator review

## Log

- 2026-10-25 - Drafted problem frame for #203 from current prod source and the disposable CDN reproduction. No implementation or production changes. Awaiting agreement on preview access and revocation expectations before drafting the shape.
- 2026-10-25 - User approved the recommended five-minute bearer preview access and requested the next layer. Confirmed the problem frame and drafted the D1-owned reference/CDN-gate shape. Playback renewal remains an explicit validation risk, not a proven gapless behavior. Awaiting shape feedback before contracts or alternatives.
- 2026-10-25 - User challenged URL replacement during long playback and the cost of a public CDN database lookup. Accepted renewable exact-path signed cookies, new private upload keys and explicit public copies on publication. Authorized implementation through an open PR, not deployment or production migration. The current shape supersedes the original D1 gate.
- 2026-10-25 - Implemented the API grant, CDN cookie boundary, browser lifecycle, publication copies and Alchemy signing-key bindings. Review found and removed an unsafe inherited-show-artwork authorization shortcut; private show artwork requires independent show permission. Added collaborator release access and exact-payload publication repair coverage.
- 2026-10-25 - Server unit (567), D1 (129) and CDN (27) tests pass. WWW unit tests (256), production build and root `bun precommit` pass. A real Chromium browser against disposable same-site HTTPS API/D1/CDN/R2 fixtures loaded private artwork and range audio with cookies, renewed after two minutes with one audio source assignment/load event and no renewal-time seek/pause, preserved paused state on recheck, and paused on membership removal. Denial now closes player overlays so its error is visible. Anonymous private access returns 403; anonymous public playback makes no preview requests. Desktop/tablet/narrow captures and interaction clips were inspected. Disposable proof services and workspace scripts were removed. Cloud-provider execution, production edge inventory and nonproduction same-site domain setup remain unverified. Deliver as a PR against prod without merging/deploying; do not auto-close #203.
