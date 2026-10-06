# Read-latency implementation and measurements

## Implemented

- `43bf9ac`: audio detail tags are projected in the authorized content query, removing one read.
- `0d2f0fb`: Better Auth joins session and user in one D1 statement. Cookie caching remains disabled; revocation and role changes remain authoritative.
- `9fbc5bc`: show detail uses one API-owned page request instead of six. Content owns metadata, and episode, navigation and subscription reads run concurrently after show resolution.
- `b091bc6`: show detail, navigation and episodes project tags within their content queries, removing the last separate label reads from show pages.
- `fd6b92d`: browser regression coverage for composed show pages.

Remote D1 configuration is unchanged. Correctness fixtures use disposable D1. Remote timing probes use the existing authorized login and read existing pages, with credentials injected by `2password` and session cookies held in memory. No credentials or response bodies are recorded.

## First integrated remote sample

2026-10-06. Four serial reads followed by three rounds of three concurrent reads, with ten seconds between rounds. All 13 returned 200 and a signed-in principal. Test/build processes had finished before measurements began.

| Route | Earlier authenticated samples | First integrated samples | Count |
| --- | --- | --- | ---: |
| `mixes/fer-1` | 1,034 to 1,123 ms | 743 ms | 1 |
| `mixes/gb51` | 1,006 to 1,137 ms | 628 to 688 ms, mean 657 ms | 4 |
| `shows/farendradio` | Included in 1,443 to 1,715 ms show range | 1,072 to 1,109 ms, mean 1,092 ms | 4 |
| `shows/gbfm` | Included in 1,443 to 1,715 ms show range | 1,072 to 1,191 ms, mean 1,131 ms | 4 |

These are repeated observations against the same remote path, not randomized production benchmarks.

### Trace evidence

- Mix trace `4f8faea9f7d88e2e9863c44063453419`, request `a840d21d-63bd-4439-82e7-0ac06de20b23`: WWW 641 ms; auth 208 ms, combined audio query 210 ms, favorite 206 ms. Exactly one page API call. The separate label span is gone.
- Show trace `7cb59c953ed9ccdb2ba800d3d235638e`, request `cb63be58-1367-4b1f-86e4-b9035a309bc3`: WWW 1,104 ms; auth 220 ms, show detail 425 ms, then navigation 425 ms, episodes 409 ms and subscription 216 ms in parallel. Exactly one page API call.
- Remaining separate labels account for about two serial remote legs on the show critical path. A focused follow-up applies the proven query projection to show detail, navigation and episode rows.

## Integrated verification before label follow-up

- `bun precommit`: passed across the workspace.
- Server `bun run test`: 535 unit/integration tests and 112 D1 tests passed.
- WWW `bun run unit`: 132 passed.
- API `bun run test`: 30 passed.
- WWW production build passed; existing large-client-chunk warning remains.
- Audio/show Playwright suite: 16 passed across Mobile Safari and Mobile Chrome, two workers, disposable API at port 30377 and WWW at 51777.
- New browser cases cover show SSR without JavaScript, canonical metadata, client-side dial transitions, empty episodes, HTML/data 404s, and isolated listener subscription persistence.
- Agent-browser also verified show dial navigation against disposable fixtures.

## Final remote sample after combined show-label queries

Repeated the same 13-read probe after the focused label follow-up, with no test/build load running. All returned 200 with a signed-in principal.

| Route | Final range | Mean | Count |
| --- | --- | ---: | ---: |
| `mixes/fer-1` | 709 ms | 709 ms | 1 |
| `mixes/gb51` | 629 to 680 ms | 660 ms | 4 |
| `shows/farendradio` | 684 to 718 ms | 701 ms | 4 |
| `shows/gbfm` | 696 to 772 ms | 733 ms | 4 |

Show pages now execute five content/state statements for the populated authenticated fixture, excluding the single auth statement; anonymous pages execute four. Show detail and navigation each take one query, loaded-show episodes take two parallel queries (count and rows), and subscription takes one. Existing pagination totals and public/admin visibility remain unchanged. Unlike the previous batched-label path, a 100-show dial does not add label round trips.

Final representative traces:

- Mix `0847181164995f400e2a4ec558b9f064`, request `d2eae9b0-a343-43e7-a66d-bc1bfad1baa8`: WWW 669 ms; session 210 ms, audio query 213 ms, favorite 222 ms.
- Show `ed23a4086b2a59db3dbf1f77f3dc3b4a`, request `cbf8a314-0e90-469f-8aea-a44263f164e7`: WWW 673 ms; session 217 ms, show 214 ms, then episodes 217 ms, navigation 224 ms and subscription 217 ms in parallel.
- Show `253de37b3ed2001791db8b14408793df`, request `0f5bc112-68dd-4da7-8f49-afa1e5a2bc84`: WWW 687 ms; session 195 ms, show 189 ms, then episodes 280 ms, navigation 218 ms and subscription 232 ms in parallel.

The remaining critical path is three serial remote waits. The two remote passes made 26 authenticated reads in total, with no 503s or long spike. This does not establish that the earlier intermittent failures are fixed.

Follow-up validation: 67 targeted tests across eight suites passed, covering generated SQL, label ordering/escaping/nulls, entity isolation, draft privacy, pagination and the 100-show dial. Integrated `bun precommit` and `git diff --check` passed after the follow-up.

Restarted the disposable API with the final query changes and reran the 16 browser cases. Fifteen passed; the Safari dial case was blocked by a Vite error overlay: `Response body object should not be disturbed or locked`, originating in `@foldkit/vite-plugin/dist/ssr.js` `toWebRequest`. Both Safari and Chrome dial cases passed when run in isolation with one worker. The parallel dev-server run is not claimed fully green; the overlay cause remains outside this query change's established evidence. No automatic retries or overlay suppression were added. Failure evidence is under `/private/var/folders/pg/vp1mhynx13v3qrprvnbccpk40000gn/T/opencode/read-latency-final-e2e`.

## Transport findings

See [session and transport findings](04-session-transport-findings.md). Local remote access adds a workstation-to-preview-worker leg; production uses the native D1 binding. There is no application-managed TCP connection pool to tune. Existing preview-session reuse was retained. Smart Placement and replica reads require separate deployment/consistency decisions and were not applied.

No push, deployment, schema changes or remote content writes were performed. The earlier intermittent spike is not claimed fixed.
