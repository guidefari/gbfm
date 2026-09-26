# Upstream provenance

- Repository: https://github.com/dmmulroy/anti-slop
- Vendored revision: `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`
- Updated: 2026-09-25

The complete non-test contents of upstream `src/` are vendored here. All generic rules and the
optional Effect rule group are enabled as errors in the root Oxlint configuration. Repository
formatting is intentionally handled by the root Oxfmt configuration, so upstream source formatting
may be normalized without changing rule behavior.

The vendored ESLint Stylistic-derived spacing implementation retains its upstream license and
provenance under `vendor/eslint-stylistic/`.
