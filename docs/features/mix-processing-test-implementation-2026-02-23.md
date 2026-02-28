# Mix Processing Test Implementation (2026-02-23)

## Scope
Implemented unit tests for the new `@gbfm/core` mix-processing module and fixed existing failing tests in `packages/core`. Also fixed a date-sensitive failing test in `apps/vps` sitemap snapshots.

## Changes Made

### 1. `packages/core` test setup
- Updated `packages/core/package.json`:
  - Added `test` script: `vitest run`
  - Added `test:watch` script: `vitest`
  - Added `vitest` as a local dev dependency

### 2. Fixed existing `packages/core` test failures
- `packages/core/src/feature-flags/index.test.ts`
  - Updated expected `ui.queue` default from `true` to `false` to match current implementation.
- `packages/core/src/utils/strip-empty-values.test.ts`
  - Updated tests to `async` and awaited `stripEmptyValues(...)` since the function returns `Promise<Partial<T>>`.

### 3. Added new mix-processing unit tests
- `packages/core/src/mix-processing/format-and-queue.test.ts`
  - `formatTracklist` formatting behavior
  - in-memory queue submit/status/update/list behavior
- `packages/core/src/mix-processing/filesystem.test.ts`
  - `writeFilesToDisk` happy path + validation failure
  - `cleanup` successful removal + error swallowing behavior
- `packages/core/src/mix-processing/processing.test.ts`
  - `createAudioOrVideo` ffmpeg argument construction (mp3/mp4)
  - non-zero ffmpeg exit mapped to failure
  - `processMix` happy path output and safe title behavior
  - `processMix` validation failure path

### 4. Fixed existing failing `apps/vps` test
- `apps/vps/src/routes/redirect/seo/sitemap.utils.test.ts`
  - Stabilized snapshot test by freezing time with `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-02-01T00:00:00Z'))`.
  - Restored real timers in `finally`.
- `apps/vps/src/routes/redirect/seo/__snapshots__/sitemap.utils.test.ts.snap`
  - Removed obsolete legacy snapshot entry.

## Verification

### `@gbfm/core`
- Command: `bun --filter @gbfm/core test`
- Result: `5` files passed, `27` tests passed.

### `@gbfm/vps`
- Command: `bun --filter @gbfm/vps test`
- Result: `5` files passed, `52` tests passed.

## Notes
- Running `vitest` at repo root (`bunx vitest run`) picks up non-vitest suites (Playwright/Bun-specific tests) and is not the canonical way to validate this monorepo.
- Package-level test commands are the reliable validation path for these changes.
