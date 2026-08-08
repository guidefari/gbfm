# Draft music entity backfill — WIP summary

## Goal

48 draft posts were imported from Bluesky with music links embedded as
plain text in the post body. The goal is to resolve each link into a real
music entity (`music_entity_links` rows across Spotify/Apple Music/Tidal/
Deezer/etc.) so drafts can be reviewed with proper enriched cards instead of
bare URLs, ahead of eventually publishing them.

## What already existed

The hard part was already built and live in the Bluesky import path:

- `apps/vps/src/services/music-link-scraper.service.ts` — pluggable
  `MusicDataProvider` interface. `OdesliProvider` (song.link, no API key)
  converts one seed URL into 15+ platform links in a single call.
- `apps/vps/src/services/music-entity/scrape.service.ts` —
  `scrapeAndCreateEntityEffect` orchestrates scrape → find-or-create artist →
  create album/track/playlist → insert links, dedup'd by existing URL.
- `apps/vps/src/services/bluesky-archive.service.ts` — calls the above at
  import time and sets `posts.musicEntityType` / `musicEntityId`.
- `apps/vps/src/services/spotify.service.ts` — Spotify client-credentials
  client (`getTrack`, `getAlbum`, `searchAlbums`, `enrichTrackFromUrl`).

What was missing: a way to re-run this for drafts that already exist but
failed to resolve at import time, and a fix for *why* they failed.

## Root cause found

Of 148 posts currently missing a music entity, most have a real,
resolvable music URL — Odesli just can't resolve **Bandcamp** URLs right
now (`{"statusCode":400,"code":"could_not_fetch_entity_data"}` on live
testing across multiple unrelated Bandcamp tracks/albums). Spotify-sourced
drafts resolve fine as-is.

No existing fallback covered this. `apps/vps/src/services/
bandcamp.service.ts` already scraped Bandcamp's embedded JSON-LD for
title/artist/art (used by `enrichTrackFromUrl`), but that code path wasn't
wired into the scraper pipeline at all.

## What was built

**1. Bandcamp metadata: extract ISRC, fix artist bug**
(`bandcamp.service.ts`)

- Added `isrcCode` extraction from the track page's JSON-LD.
- Rewrote JSON-LD parsing with `effect/Schema` (`Schema.Struct` +
  `Schema.decodeUnknownOption`) instead of raw `JSON.parse` + manual field
  access, matching the pattern already used for Odesli/MusicBrainz
  responses elsewhere in the scraper.
- **Real bug fixed:** on a Bandcamp *track* page, the top-level `byArtist`
  in JSON-LD is the **label**, not the performer (e.g.
  `echocord.bandcamp.com/track/en-route` → top-level `byArtist.name` is
  "Echocord", but the actual artist is "Fluxion", found under
  `inAlbum.byArtist.name`). This would have silently produced wrong artist
  names for any label that doesn't share its name with the artist. Fixed by
  preferring `inAlbum.byArtist` when present.

**2. Spotify search fallback** (`spotify.service.ts`)

- `searchTrackByIsrc(isrc)` — exact match via Spotify's `isrc:` search
  filter. Verified precise (no ambiguity) against multiple real ISRCs.
- `searchAlbumByTitleArtist(title, artist)` — `album:X artist:Y` search,
  used when there's no ISRC (album-level Bandcamp pages don't have one).

**3. New `BandcampProvider`** (`music-link-scraper.service.ts`)

- Only supplies `entityMeta` (title, artist, thumbnail, ISRC) via the
  existing `getBandcampMetadataWithSpan` — no direct platform links, since
  Bandcamp isn't a source of cross-platform data.

**4. Orchestration: Bandcamp → Spotify search → re-Odesli**

In `makeScraperWithProviders`, after all providers run: if no Spotify link
was found but we do have `entityMeta`, search Spotify (by ISRC for tracks,
title+artist for albums), then re-run `OdesliProvider` against the
resulting Spotify URL to backfill the full platform fan-out.

Verified end-to-end against 3 real failing Bandcamp URLs before hitting
rate limits — all three resolved with correct artist names, ISRCs, and
4-5 cross-platform links (Amazon Music, Deezer, Tidal, Spotify, Bandcamp).

**5. Odesli retry/backoff**

`OdesliProvider.fetchLinks` now retries on HTTP 429 with
`Schedule.exponential('1 second').pipe(Schedule.upTo({ times: 3 }))`
(Effect 4 beta API — note `Schedule.compose`/`recurs` combo from Effect 3
docs doesn't exist here; `upTo` is the right primitive for "existing
schedule, capped by count").

**6. Backfill script**
(`apps/vps/scripts/backfill-draft-music-entities.ts`)

- Queries `posts` where `music_entity_id IS NULL`, extracts a candidate
  music URL from `content` (same host allowlist logic as the Bluesky
  importer: Spotify, Apple Music, SoundCloud, YouTube, Tidal, Deezer,
  Audiomack, any `*.bandcamp.com`).
- Re-runs the scrape pipeline, writes `musicEntityType`/`musicEntityId`
  back onto the post.
- `Effect.forEach(..., { concurrency: 1 })` with a 1.5s `Effect.sleep`
  between drafts — Odesli gives no `Retry-After` header, so this is a
  blind but necessary throttle to avoid re-triggering rate limiting across
  a full run.
- Dry-run by default; `--apply` flag required to actually write.

## Wiring changes

`MusicLinkScraperServiceLayer` changed from `Layer.sync` (no deps) to
`Layer.effect` requiring `SpotifyService` (needed for the search fallback).
Updated `apps/vps/src/runtime/services.ts` so
`MusicLinkScraperServiceLayer.pipe(Layer.provide(SpotifyServiceLayer))` —
previously both sat flat in the same `Layer.mergeAll` with no explicit
dependency edge.

## What happened during testing (self-inflicted)

Manual testing plus an early un-throttled dry run fired enough rapid
requests at Odesli's free API that it started returning 429 with no
`Retry-After` hint. As of writing, still rate-limited 30+ minutes later —
longer than expected, window is unknown. Waiting it out rather than
hammering it further; the fixes above (retry + throttle) should prevent
recurrence once it clears.

An old un-throttled dry run did finish before I could add the fixes: 25
resolved / 148 total, 75 failed (mostly 429 casualties from before
throttling existed), 48 skipped (no music URL in content — e.g. one row is
literally the account's bio/template text, not a real draft). **Not
representative of the current code** — don't act on these numbers.

## Still open / to revisit

- **Odesli dependency risk**: it's the only source of the full
  cross-platform fan-out from one URL. No `Retry-After` header means we
  can't know when a rate limit clears — only blind exponential backoff.
  Options if this becomes a recurring problem:
  - Add Deezer's public search API (free, keyless) as a second
    `entityMeta`-driven fallback alongside Spotify, so a stuck Odesli
    doesn't fully block resolution (would only backfill the Deezer link
    itself, not the full fan-out).
  - Apple Music (MusicKit, needs a paid dev account + signed JWT) and
    Tidal (partner API access) would need real integration work — not
    started.
- **Not yet run for real**: dry run needs to be re-executed once Odesli's
  limit clears, reviewed, then `--apply` run once confirmed. Currently
  targeting the **local restored DB** (prod snapshot pulled via
  `db:backup:prod` + `restore-db.ts --destination=local`), not prod
  directly — per standing rule to never write to prod without a verified
  dry run first.
- One draft (`81759a6a-1b81-401d-8ff6-0bcea95d1bf1`) is a template/bio
  post with no music link at all — correctly skipped by the script, no
  action needed.

## Files touched

- `apps/vps/src/services/bandcamp.service.ts` — ISRC extraction, Schema
  parsing, artist bug fix
- `apps/vps/src/services/spotify.service.ts` — `searchTrackByIsrc`,
  `searchAlbumByTitleArtist`
- `apps/vps/src/services/music-link-scraper.service.ts` —
  `BandcampProvider`, Spotify-fallback orchestration, Odesli retry
- `apps/vps/src/runtime/services.ts` — layer dependency wiring
- `apps/vps/scripts/backfill-draft-music-entities.ts` — new backfill
  script (untracked, not yet committed)
