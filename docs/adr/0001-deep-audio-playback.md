# ADR-0001: Deep Audio Playback Module

## Status

Accepted

## Date

2026-07-26

## Context

We need one shared playback module for web and mobile to own queue hydration, source lifecycle, restoration, completion, reporting, and persistence.

## Decision

Keep a single deep `AudioPlayback` module with internal seams for device, store, and reporter.

- Web uses HTML Audio plus real Media Session commands.
- Mobile uses Expo Audio for playback and lock-screen metadata/activation.
- Expo-audio has no JS remote next/previous callback interface, so we keep native lock-screen play/pause behavior and do not fake command routing.

## Consequences

- One place owns hydration, stale-source rejection, and teardown.
- Play analytics stay tied to successful playback starts.
- Browser Media Session commands remain real and tested.
- Expo lock-screen limitations are explicit instead of hidden behind fake callbacks.
