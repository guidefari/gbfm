# Migration Blockers

## 2026-08-09: Bundle gate interpretation changed concurrently

Commit `6c8dc959` changed `d1-bundle-size.md` after the current-Bun graph
measurement to define the gate as the future ported graph. The two measurements
answer different questions:

- Current HTTP graph: 3,907,876 gzipped bytes, which does not fit.
- Ported graph after externally excluding planned M3/M4 removals: 2,684,671
  gzipped bytes with MDX precompiled, which fits.

The later commit's ported-graph conclusion is retained as the bundle gate
verdict. It excludes the replacement Cloudflare Sentry SDK, so M4 must bundle
the actual Worker entry after that SDK is wired. The 256 KiB MDX-retained margin
is not sufficient evidence that the final production Worker will fit.
