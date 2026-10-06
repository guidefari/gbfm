# Reduce steady-state page-read latency

## Goal

Reduce authenticated mix and show page response times from the observed 1.0 to 1.7 seconds. Keep remote D1 access for comparative measurements. The intermittent 9 to 16-second spike remains a separate, unproven issue.

## Constraints

- Preserve draft visibility, session revocation, user isolation, cookie renewal, SSR and navigation behavior.
- Optional metadata or action-state failure must not suppress otherwise available content.
- No production writes for fixtures, schema migrations, deployment or push.
- Use disposable D1 for correctness tests and bounded read-only remote probes for timings. Login may create the explicitly authorized test session.
- Do not infer production gains from local proxy timings. D1 bindings do not expose a conventional application-managed connection pool.
- Leave existing staged investigation/progress edits untouched.

## Parallel implementation tracks

### A. Audio read path

Own audio services, audio-specific database query helpers and their tests. Remove the separate label round trip where a correct relational projection or combined query is supported. Identify safe overlap for favorite reads without exposing unauthorized audio. Retain existing service contracts and optional-failure behavior. Verify generated SQL against disposable D1 and preserve ordering and empty-label semantics.

### B. Show page composition

Own show API contracts, handlers, show-page composition, WWW show loading and targeted tests. Introduce one API-owned show page read, reuse loaded content for metadata, resolve identity once, and run episodes and subscription reads concurrently once their dependencies are available. Preserve existing endpoints and page status/cookie behavior. Avoid shared audio and authentication implementation files.

### C. Session and transport

Own authentication/database transport configuration and focused tests. Inspect pinned Better Auth, Drizzle, Alchemy and D1 implementations before choosing an optimization. Determine whether session and user reads can be combined with supported joins while preserving revocation and renewal. Inspect remote transport reuse, retries and production placement support. Implement only evidenced, behavior-preserving application improvements; report infrastructure proposals rather than deploying them.

## Integration and validation

1. Review each track's diff and targeted test evidence, including cross-track interfaces.
2. Run relevant API/server/WWW tests and `bun precommit` after integration. Use browser checks for changed navigation behavior.
3. Measure identical authenticated remote routes serially, then with at most three concurrent callers. Record statuses, request IDs, traces, read counts and repeated timings. Stop on errors or substantial slowdowns.
4. Compare observed critical-path reads and elapsed times against the recorded baseline. Report remaining costs and distinguish local transport from production evidence.
5. Create atomic commits for reviewed changes, staging exact files. Never include unrelated staged edits, secrets or probe credentials. No push or deployment.
