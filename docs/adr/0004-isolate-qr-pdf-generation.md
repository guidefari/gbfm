# ADR-0004: Isolate QR PDF generation

## Status

Proposed

## Date

2026-09-02

## Context

The API Worker generated QR PDFs synchronously with `pdf-lib` and `qrcode`. It switched from JetBrains Mono to a built-in Helvetica font when filesystem font loading prevented the Cloudflare Worker from starting.

JetBrains Mono can be restored without filesystem access, but `fontkit` and the font data leave too little room in the API Worker's compressed script limit. Wrangler dry-run measurements from this branch were:

| Shape | Compressed script |
| --- | ---: |
| Existing API Worker | 2,460.23 KiB |
| API Worker plus `fontkit` | 2,878.01 KiB |
| API Worker plus `fontkit` and one bundled weight | 3,045.94 KiB |
| API Worker plus `fontkit` and two bundled weights | 3,211.19 KiB |
| Isolated API Worker after this change | 2,228.28 KiB |
| Isolated QR PDF Worker after this change | 774.19 KiB |

The two TTF assets total 548 KiB uncompressed and are uploaded through Workers Static Assets rather than included in either script. Cloudflare's [Free plan allows a 3 MiB compressed Worker script](https://developers.cloudflare.com/workers/platform/limits/#worker-limits), so even one bundled weight would leave about 26 KiB of headroom and two would exceed the limit.

The feature is interactive and low-frequency. Callers expect an immediate download URL, while R2 handles repeat requests through a generated-object cache. A queue would add job state, polling, delayed failures, and retry policy without evidence that generation needs durable asynchronous work.

## Decision

Run QR PDF generation in a private Cloudflare Worker invoked synchronously through a service binding.

- The API Worker keeps entity lookup and its public HTTP interface.
- A parsed DTO crosses the service binding.
- The QR PDF Worker owns rendering, font loading, cache lookup, and the R2 write, then returns `{ url, cached }`.
- JetBrains Mono font files deploy as private static assets attached to the QR PDF Worker.
- Generated object keys include a digest of the template version and rendered content, making their URLs immutable.
- Public force-regeneration is removed. A template-version or content change naturally produces a new object.
- Generated objects remain in R2 for seven days, longer than the web client's 24-hour query freshness window.
- Generation stays synchronous. No Queue, Durable Object, Workflow, or external container is introduced.

## Consequences

- JetBrains Mono is restored without risking the API Worker's script-size limit.
- Heavy PDF dependencies no longer increase API cold-start and deployment size.
- Font files and rendering code deploy together, without runtime R2 configuration for font assets.
- Cache hits still cross one internal service binding before the R2 metadata lookup.
- The deployment gains one private Worker and one runtime-hop contract.
- Failures remain immediate HTTP failures rather than becoming asynchronous job failures.
- If measured CPU or request volume later exceeds Worker limits, the isolated module can move behind a queue or another compute adapter without changing the public HTTP interface.
