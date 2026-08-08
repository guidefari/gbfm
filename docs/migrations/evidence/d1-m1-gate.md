# D1 Migration M1 Gate

## Verdict: PASS with required follow-ups

The stated M1 gate passes:

| Gate requirement | Evidence | Result |
| --- | --- | --- |
| Worker bundle fits | `d1-bundle-size.md` | Ported graph is 2,684,671 bytes gzipped with MDX precompiled, below 3 MiB. |
| Transaction classification complete | `d1-transaction-classification.md` | 24 actual call sites: 18 A, 5 B, 1 C. The spec's 41-site count is stale. |
| Search and ordering fixture exists | `d1-search-fixture.md` | Local Postgres results captured for substring, tags, case, empty, punctuation, and null ordering. |

There are no `UNCERTAIN` transaction classifications. The B rewrites have
specific guarded-write designs, and navigation is the sole Durable Object site.

## Required Follow-ups

- M4 must remeasure the actual Worker entry after adding the Cloudflare Sentry
  SDK. The MDX-retained ported graph has only about 256 KiB of headroom.
- Repair or formally document the missing initial Postgres migration and the
  invalid redundant constraint drops before M3/M5. See `BLOCKERS.md`.
- Database size and peak write rate remain outstanding. They must be measured by
  a human with authorized production access. No production access was sought or
  used for M1.
