# Effect Language Service: Typecheck passes locally but fails in CI

## Problem

`bun typecheck` passes locally with exit code 0, but fails in CI (GitHub Actions) with exit code 2. The CI output shows Effect-specific diagnostics like:

```
warning TS23: The adapter of Effect.gen is not required anymore...
warning TS35: Global 'Error' loses type safety...
message TS29: This Effect.fail call uses a yieldable error type...
```

These are **not** standard TypeScript errors — they come from `@effect/language-service`.

## Root cause

The `prepare` script in root `package.json` runs:

```json
"prepare": "effect-language-service patch"
```

This patches two files inside `node_modules/typescript/lib/`:

| File | What it does | Affects |
|------|-------------|---------|
| `typescript.js` | Language service (editor integration) | VS Code, IDEs |
| `_tsc.js` | CLI compiler (`tsc --noEmit`) | Terminal, CI |

When `_tsc.js` is patched, running `tsc --noEmit` emits Effect diagnostics as warnings/messages. Warnings cause exit code 2 by default.

## Why it didn't reproduce locally

The patch state of `_tsc.js` depends on whether `bun install` triggered the `prepare` script **and** whether the patch ran against the current `node_modules/typescript` installation.

Common reasons the local `_tsc.js` stays unpatched:

- `bun install` used a cached `node_modules` and didn't run `prepare`
- A previous `bun install` ran before the `prepare` script was added
- `node_modules` was partially reinstalled (e.g., after deleting `.bun` cache but not `node_modules`)
- The patch was previously only applied with `--module typescript` (editor only)

In CI, `bun install` always runs fresh, so `prepare` always executes and patches both files.

## How to check / reproduce

Verify the patch state:

```bash
bun run effect-language-service check
```

Expected output when both are patched (matching CI):

```
INFO: .../typescript.js patched with version 0.72.0
INFO: .../_tsc.js patched with version 0.72.0
```

If `_tsc.js` shows "is not patched", force the patch:

```bash
bun run effect-language-service patch
```

Then run typecheck to reproduce CI behavior:

```bash
cd apps/vps && bun run typecheck
```

## Configuration options

The `@effect/language-service` plugin in `tsconfig.json` supports:

```jsonc
"plugins": [{
  "name": "@effect/language-service",
  "ignoreEffectWarningsInTscExitCode": true,    // warnings won't cause exit code 2
  "ignoreEffectSuggestionsInTscExitCode": true   // default: true
}]
```

Setting `ignoreEffectWarningsInTscExitCode: true` will still display warnings but won't fail the build. This is useful if you want visibility without blocking CI.

## To fix properly

Fix all the Effect diagnostics in the codebase so `tsc` exits cleanly with code 0. The diagnostics are actionable best-practice suggestions from the Effect team.

## Useful commands

```bash
# Check patch state
bun run effect-language-service check

# Apply patch (both editor + CLI)
bun run effect-language-service patch

# Remove patch (both editor + CLI)
bun run effect-language-service unpatch

# Apply patch for editor only (won't affect tsc CLI)
bun run effect-language-service patch --module typescript

# Run Effect diagnostics standalone (without patching tsc)
bun run effect-language-service diagnostics --project apps/vps/tsconfig.json
```
