# Spotify Effect 0.6.7 on Effect 4.0.0

The published `@spotify-effect/core` and `@spotify-effect/browser` 0.6.7 packages
still import `effect/unstable/http` and declare an Effect `4.0.0-rc.111` peer.
Effect 4.0.0 moved that module to `effect/http`.

These Bun patches change only HTTP import paths in ESM, CommonJS, and TypeScript
declarations. They do not change Spotify behavior or suppress the peer mismatch.
Remove them when an upstream release supports Effect 4.0.0.

Verify with the Spotify service tests, the `@gbfm/spotify` tests, and WWW's
`e2e/spotify.spec.ts`, which exercises PKCE, profile loading, and disconnect
through the real browser adapter with disposable HTTP fixtures.
