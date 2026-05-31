# ADR-001: Audio Player State Management Refactor

## Status

Accepted

## Date

2025-08-05

## Context

The audio player in the Goosebumps.fm web application was previously implemented using React Context API

- Manual localStorage persistence utilities
- React Context provider wrapping

Users experienced issues with:

- Audio player state not persisting across page reloads
- No visual indication of remaining playback time (not a context issue, just hadn't implemented the feature)

I wanted a light way to handle some persisted state.

## Decision

decided to refactor the audio player state management from React Context to Zustand with the following architectural changes:

### 1. State Management Migration

- **From**: React Context API with manual persistence
- **To**: Zustand store with built-in persist middleware

### 2. Persistence Strategy

- **From**: Custom localStorage utilities with manual state serialization
- **To**: Zustand persist middleware with automatic state hydration
- **Key Innovation**: Persist `audioSrc` (audio source URL) separately from the HTML audio element to enable proper state restoration

### 3. Audio Element Management

- **From**: Audio element created in React Context provider
- **To**: Audio element created via custom hook (`useAudioPlayerInitializer`) at app level
- **Initialization**: Automatic restoration of audio source and playback position on app startup

### 4. Component Architecture

- **From**: Complex context consumer pattern with array destructuring (tuples)
- **To**: Simple, focused hooks (`useAudioPlayerState`, `useAudioPlayerActions`)
- **Benefits**: Better tree-shaking, clearer dependencies, improved TypeScript IntelliSense, feels like less repetition too

### 5. Time Display Enhancement

- **Addition**: Time remaining display with format `-MM:SS`
- **Layout**: Elapsed time (left) and remaining time (right) for better UX

## Technical Implementation

### Store Structure

```typescript
interface AudioPlayerState {
  // Audio element ref (not persisted)
  audioRef: HTMLAudioElement | null

  // Playback state
  isPlaying: boolean
  progress: number
  currentTime: number
  duration: number

  // Track info (persisted)
  audioSrc: string | null // Critical for restoration
  thumbnailUrl: string
  nowPlayingContext: NowPlayingContext

  // State management
  isInitialized: boolean
}
```

### Key Persistence Fields

- `audioSrc`: The source URL of the current audio track
- `currentTime`: Playback position in seconds
- `thumbnailUrl`: Track artwork
- `nowPlayingContext`: Track metadata (title, page URL)

### Initialization Flow

1. App starts → `useAudioPlayerInitializer()` creates HTML audio element
2. Audio element attached → Zustand store receives reference
3. Persisted state loaded → Audio source and position restored automatically
4. UI components → Subscribe to specific state slices via focused hooks

## Consequences

### Positive

- **Improved Persistence**: Audio player state now reliably persists across page reloads
- **Better Performance**: Granular subscriptions prevent unnecessary re-renders
- **Developer Experience**: Redux DevTools integration for debugging
- **Type Safety**: Better TypeScript support with focused hook returns
- **Simplified Testing**: Easier to test individual store actions
- **User Experience**: Time remaining display provides better playback awareness

### Neutral

- **File Organization**: Store moved to `/apps/www/src/store/audioPlayer.ts`
- **Hook Structure**: New hook patterns require updating imports

## Files Changed

### Created

- `/apps/www/src/store/audioPlayer.ts` - Main Zustand store
- `/apps/www/src/hooks/useAudioPlayer.ts` - Audio element initialization

### Modified

- `/apps/www/src/components/AudioPlayer.tsx` - Updated to use Zustand hooks
- `/apps/www/src/components/PlayPauseButton.tsx` - Simplified track loading
- `/apps/www/src/components/Layout/AppShell.tsx` - Audio player initialization
- `/apps/www/src/routes/__root.tsx` - Removed AudioProvider wrapper
- `/apps/www/src/routes/mixes.tsx` - Updated to use new hooks
- `/apps/www/src/store/index.ts` - Export new audio player hooks

### Removed

- `/apps/www/src/contexts/AudioPlayer.tsx` - Legacy React Context
- `/apps/www/src/lib/audioPlayerPersistence.ts` - Manual persistence utilities

## Monitoring

Success will be measured by:

- Zero reported issues with audio player persistence
- Improved user engagement with audio content

## Notes

This refactor maintains 100% backward compatibility from a user perspective while significantly improving the technical foundation. It was nice to tidy up an area of the codebase that I wrote once, and never got the time to get back to. And I basically went with my first decision at the time.

The time remaining display enhancement was implemented as part of this refactor to improve user experience during audio playback.
