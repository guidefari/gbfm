# ADR-0002: Internal playback transitions

## Status

Accepted

## Date

2026-07-26

## Context

AudioPlayback already owns the user-facing playback seam. The intent, preparation, completion, and position transitions are implementation details of that deep module, not a separate product API.

## Decision

Keep the playback transition state machine private inside the AudioPlayback/playerCore implementation.

- Do not export transition helpers from `@gbfm/player`.
- Test the transitions through AudioPlayback/playerCore behavior, not a second public seam.

## Consequences

- One public playback contract stays authoritative.
- Tests cover observable playback behavior instead of internal helpers.
- Generations, hydration, and completion re-arming remain implementation details.
- Callers do not gain a second way to couple to the playback state machine.
