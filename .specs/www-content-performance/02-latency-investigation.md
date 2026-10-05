# Local backend latency investigation

## Status: root cause not established

2026-10-05. Read-only investigation against `https://gbfm.localhost`. No application, database, infrastructure or deployment changes.

## Latest user trace batch

The batch runs from 16:46:59 to 16:47:58 UTC. Page requests returned 200, but the final three overlapped and slowed down across different database-backed operations.

| Request | WWW time | API request count | Trace |
| --- | ---: | ---: | --- |
| Tweet detail samples | 651 to 996 ms | 4 | Multiple |
| Mix `fer-1` | 1,050 ms | 1 | `1360e39e2a72b74110f902535d5906cf` |
| Mix `far-end-radio-transmission-002` | 1,145 ms | 1 | `d8922183dbc8cc7ebcea0d7f79fe2e3d` |
| Mix `gb51` | 9,356 ms | 1 | `3f22748d8c8d40b8bed3321a462fa0e8` |
| Show `farendradio`, earlier | 1,688 ms | 6 | `6fba222ab86e681b0f1cd9b1cabe88fb` |
| Show `farendradio`, later | 15,928 ms | 6 | `f78a8b2ff0672ca205aa3a04ca8e8c7e` |
| Show `gbfm` | 11,956 ms | 6 | `3036409952e8474141b68ace9af69f13` |

Loki API request summaries confirm the long durations independently of Jaeger. The slow mix API request took 9,345 ms. Show episodes took 6,542 and 8,602 ms; subscription requests took 5,378 and 7,291 ms.

### Audio read ownership is correct

The signed-in `fer-1` trace contains one session resolution (377 ms), one audio query (214 ms), one label projection (228 ms), one favorite lookup (211 ms), and 4 ms of content rendering.

The slow `gb51` trace retains that same shape: session 4,002 ms, audio query 1,133 ms, labels 1,140 ms, favorite lookup 3,067 ms, rendering 3 ms. The audio fix removed duplicate work but cannot prevent each remaining read from waiting on a slow backend.

These spans do not distinguish database execution, transport waiting, retry delays or shared process contention. No production speedup or root cause can be inferred from them.

### Other page work remains duplicated

Show detail still makes six requests. Content and metadata each load the show; identity is resolved in separate requests; subscription loading starts after episodes. That serial dependency amplifies slow reads.

Tweet detail still makes four parallel requests and reads the same post for both screen content and metadata. Parallel requests keep elapsed time below their summed durations, but do not remove the duplicate reads.

## Reproduction attempts

Tested navigation-data reads of `/mixes/gb51`, `/shows/farendradio` and `/shows/gbfm`, without modifying content or listener state.

- Initial six anonymous reads: 420 to 1,517 ms, all 200.
- Eighteen anonymous reads with six concurrent callers: 467 to 1,762 ms, all 200.
- Twenty-four anonymous reads with twelve concurrent callers: 459 to 1,762 ms, all 200.
- Thus none of those 48 reads reproduced the 9 to 16-second spike.
- The attachable agent-browser session was not signed in. The recorded request cookie is redacted, so it cannot restore the user's session. Authenticated replay remains unavailable.

### Separate availability failures during browser probing

Nine agent-browser fetches, three concurrent requests per round, produced five WWW 503 responses. They were fast failures, not reproductions of the slow successful requests. The initial latency-only verdict incorrectly called the batch within its time limit; status must also be part of the probe verdict.

Representative failures:

| Request | WWW result | Trace | Failing operation |
| --- | --- | --- | --- |
| `e20c6f21-e322-42e3-bf61-148e02bcaeb3` | 503, 218 ms browser time | `4e4b78a0f33b3b96a8dd0c2bde45290b` | `audio.projectLabels` |
| `6d94d077-7d94-4e75-a05f-e46a15e6e336` | 503, 110 ms browser time | `6c14199585aeac00425ab6fae4f7d646` | `audio.findBySlug.query` |
| `6e16d492-8ad3-481f-90b9-3fd0d6f4b59e` | 503, 236 ms browser time | `ec603a5972ae5ad55ad91d880b635646` | Show reads, episodes and list count |

Audio returns a typed `Unavailable` outcome in an API 200 response; WWW correctly turns it into 503. Inspect the outcome and child errors rather than treating API HTTP 200 alone as availability proof.

The trace exception only says `DatabaseError`, `Failed to fetch audio: Database query failed`. The underlying transport/provider cause is not exposed there. No cause was recovered from Loki, which forwards bounded request summaries rather than all application errors.

Stopped burst testing after these failures. Two later serial mix reads succeeded in 553 and 524 ms. This proves recovery for those two reads, not the cause of either the availability failures or the earlier latency spike. The relationship between the two symptoms is unknown.

## Feedback loop and next evidence

The disposable probe is `/private/var/folders/pg/vp1mhynx13v3qrprvnbccpk40000gn/T/opencode/read-latency-probe.py`. It checks both HTTP status and a 3,000 ms threshold, prints request IDs and server timing, and exits nonzero on failure. A passing anonymous run is not a regression test for the authenticated spike.

```sh
python3 /private/var/folders/pg/vp1mhynx13v3qrprvnbccpk40000gn/T/opencode/read-latency-probe.py 1 2
```

Next evidence needed:

1. An agent-browser session signed into the original local app, to replay the authenticated request without collecting or printing cookies.
2. A slow or failed request captured with bounded database-adapter diagnostics: operation duration, transport/status category and retry count, without SQL parameters, headers, response bodies or tokens.
3. A local process responsiveness measurement alongside the database read, to separate transport waits from a blocked process.

Do not add retries, caching, indexes or a framework change based on the current evidence. Do not claim the backend spike is fixed. Show-page read consolidation remains a separate improvement, not a proven remedy for the shared slowdown.
