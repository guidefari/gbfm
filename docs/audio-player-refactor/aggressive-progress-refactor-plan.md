# Aggressive Audio Progress Refactor Plan

## Goal

Remove progress-update driven rerender pressure from the audio player so playback stays smooth even when the UI is busy.

## Core Read

The browser already decodes and plays audio outside React, but our current `timeupdate -> Zustand -> React rerender` path is still main-thread work.

The bad part is not the audio element itself.
The bad part is broadcasting progress ticks through the whole app store.

## Target Shape

1. Keep the `HTMLAudioElement` as the source of truth for actual playback time.
2. Remove `ontimeupdate` as the primary progress driver.
3. Move progress syncing into a dedicated progress loop that only runs while playing.
4. Keep the main audio store for semantic state only: play, pause, load, seek, queue, fullscreen, volume.
5. Isolate progress rendering so only the progress UI updates on each tick.

## Refactor Strategy

### 1. Split progress from store-wide state

Create a dedicated progress channel for `currentTime`, `duration`, and `progress`.

That channel should not force `BaseAudioPlayer`, `FullscreenAudioPlayer`, queue UI, or layout chrome to rerender on every tick.

### 2. Replace `timeupdate` with a controlled loop

Use a `requestAnimationFrame` loop while playback is active.

Behavior:

- start the loop on `play`
- stop the loop on `pause`, `ended`, track switch, and unmount
- read `audioRef.currentTime` once per frame
- only publish if the value actually changed enough to matter

### 3. Throttle persistence separately

Persist playback position on a slower cadence than UI progress.

Current persistence already has a 5 second gate for writes, which is good. Keep that idea, but make sure the UI tick rate and persistence tick rate are independent.

### 4. Narrow subscriptions

Stop using broad store reads in player components.

The player UI should subscribe to exactly the state it needs:

- transport controls: `isPlaying`, track info, queue, volume, mute
- progress bar: only progress fields
- fullscreen toggle: only fullscreen state

### 5. Keep progress in React for now

For this pass, keep the progress bar and time labels reactive in React.

We already removed the biggest problem by switching away from `ontimeupdate` and narrowing store subscriptions. If profiling still shows the progress UI as the bottleneck later, the next step would be an imperative DOM update path.

## Implementation Order

1. Extract progress tracking into a separate module or hook.
2. Remove `ref.ontimeupdate = () => get().updateProgress()`.
3. Add a play/pause driven progress loop.
4. Split state selectors in `BaseAudioPlayer` and `FullscreenAudioPlayer`.
5. Keep persistence writes throttled and independent.
6. Verify no unrelated component rerenders on progress ticks.
7. Revisit imperative DOM updates only if React progress rendering still shows up in profiling.

## Acceptance Criteria

- Progress still feels smooth during playback.
- No full-player rerender cascade on every tick.
- Queue, favorites, and fullscreen UI remain responsive while audio plays.
- Persisted playback position still works.
- Seeking still updates the UI immediately.

## Notes

We cannot move `audio.currentTime` reads off the main thread in a meaningful way.

What we can do is make the main-thread work tiny, isolated, and frame-budget friendly.
