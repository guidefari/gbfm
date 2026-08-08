# D1 Transaction Classification

Audit date: 2026-08-09. Scope: every literal `db.transaction(` call in
`apps/vps/src`, including nested service directories. The search found **24**
sites, not the 41 reported by `postgres-to-d1.md:55`. The lower count is an
audit finding: M2/M3 must rerun this exact search before changing transaction
code, rather than relying on the specification's stale count.

Categories:

| Category | Meaning |
| --- | --- |
| A | Pure ordered writes. Translate to one `db.batch()` with client-generated IDs or a write-only SQL subquery where a child needs a parent ID. Any result read can happen after the batch. |
| B | A read changes the write path. Move that read outside the batch and make every write conditional on a version, uniqueness constraint, or other compare-and-set guard. Retry when the guarded write affects zero rows. |
| C | The operation needs mutual exclusion, not merely an optimistic retry. Move the serialized section to a Durable Object. |

## Complete Inventory

| File | Line | Category | Actual transaction behavior | Read decision and required guard for B |
| --- | ---: | --- | --- | --- |
| `apps/vps/src/services/music-entity/artist.service.ts` | 86 | A | Deletes an artist's platform links, then deletes the artist. | N/A |
| `apps/vps/src/services/music-entity/label.service.ts` | 33 | A | Inserts a label and, when supplied, its creator link. | N/A. Generate the label UUID before the batch. |
| `apps/vps/src/services/music-entity/label.service.ts` | 160 | A | Deletes a label's platform links, then deletes the label. | N/A |
| `apps/vps/src/services/music-entity/playlist.service.ts` | 121 | A | Deletes a playlist's platform links, then deletes the playlist. | N/A |
| `apps/vps/src/services/music-entity/track.service.ts` | 27 | A | Inserts a track and upserts its ordered artist links. | N/A. Generate the track UUID before the batch. |
| `apps/vps/src/services/music-entity/track.service.ts` | 93 | A | Updates a track and upserts supplied ordered artist links. | N/A. A missing track must cause the batch to fail rather than create links. |
| `apps/vps/src/services/music-entity/track.service.ts` | 133 | A | Deletes a track's platform links, then deletes the track. | N/A |
| `apps/vps/src/services/music-entity/album.service.ts` | 28 | A | Inserts an album and upserts its ordered artist links. | N/A. Generate the album UUID before the batch. |
| `apps/vps/src/services/music-entity/album.service.ts` | 94 | A | Updates an album and upserts supplied ordered artist links. | N/A. A missing album must cause the batch to fail rather than create links. |
| `apps/vps/src/services/music-entity/album.service.ts` | 134 | A | Deletes an album's platform links, then deletes the album. | N/A |
| `apps/vps/src/services/music-entity/playlist-tracks.service.ts` | 139 | B | Reads the playlist's current track set, rejects a non-exact reorder, then writes every position. | The read decides whether the submitted IDs are exactly the current set. Read a playlist revision, then conditionally advance it with `WHERE id = ? AND revision = ?`; each position write must be conditional on the successful new revision. A zero-row revision update is a stale reorder and must reread and retry. |
| `apps/vps/src/services/music-entity/playlist-tracks.service.ts` | 470 | B | Finds or creates a Spotify track, reads the playlist's maximum position, adds the track, then reads its final position. | The reads decide track reuse versus creation, a unique slug, and the append position. Add a unique identity constraint on `(entity_type, platform, url)`, use it as the track-resolution guard, and append with one `INSERT ... SELECT COALESCE(MAX(position), -1) + 1` statement. The final position is a post-write read. Without the external-identity uniqueness constraint, concurrent imports can create duplicate tracks. |
| `apps/vps/src/services/music-entity/playlist-tracks.service.ts` | 584 | B | Finds or creates the Spotify playlist and every Spotify track, preserves an existing curator, deletes the playlist's tracks, then replaces them in source order. | The reads decide existing playlist and track identities, preserved curator, and unique slugs. Use unique external identities for Spotify links and a playlist revision guard. Every delete/insert in the replacement batch must be conditional on the guarded revision advancing; zero affected rows means the import lost a race and must reread/retry. |
| `apps/vps/src/services/show.service.ts` | 201 | A | Inserts a show and optional show-to-creator links. | N/A. Generate the show UUID before the batch. |
| `apps/vps/src/services/show.service.ts` | 276 | A | Updates a show, then replaces optional show-to-creator links. | N/A. The returned updated row is only used to fail the batch on a missing show. |
| `apps/vps/src/services/audio.service.ts` | 355 | B | Attempts idempotent audio creation, reads the existing request on conflict to distinguish replay from conflict, and inserts creator links only for a new audio row. | The read decides replay versus `AudioCreateConflict` by comparing the stored fingerprint. The existing unique `(idempotency_actor_id, idempotency_key)` index is the guard. Generate the audio UUID before writing and insert creators only when a SQL predicate confirms the stored fingerprint matches this request; a mismatch returns conflict without modifying creator links. |
| `apps/vps/src/services/audio.service.ts` | 522 | A | Replaces an audio row's creator links by deleting then inserting the supplied set. | N/A |
| `apps/vps/src/services/bluesky-account.service.ts` | 71 | A | Upserts an external account, then upserts its encrypted session. | N/A. Insert the session by selecting the account ID from its unique user/provider/provider-account identity in the later write. |
| `apps/vps/src/services/user.service.ts` | 272 | A | Deletes all user social links, inserts the submitted replacement links, then selects them for the response. | N/A. Move the response select after the write batch. |
| `apps/vps/src/services/post.service.ts` | 1230 | A | Inserts a post and its creator links. | N/A. Generate the post UUID before the batch. |
| `apps/vps/src/services/post.service.ts` | 1388 | A | Inserts a micro-post reply and its sole creator link. | N/A. Generate the reply UUID before the batch. |
| `apps/vps/src/services/bluesky-archive.service.ts` | 63 | B | Inserts a source record or reads the existing source to decide changed, locally edited conflict, or initial post creation. | The read decides whether to update the source, update its attached post's timestamp, or create a post and creator link. `at_uri` is already unique; guard the update with the read `cid`, `locally_edited`, and `post_id` snapshot. A zero-row update must reread/retry so a concurrent archive write cannot overwrite a local-edit conflict decision. |
| `apps/vps/src/services/navigation.service.ts` | 413 | C | Locks a navigation session, deduplicates an intent, detects stale cursor state, allocates the next trail position, appends the entry, and advances the cursor. | N/A. It explicitly uses `FOR UPDATE` and must serialize per navigation identity, so use a Durable Object keyed by that identity. |
| `apps/vps/src/services/bluesky-sync.service.ts` | 343 | A | Marks a sync run succeeded, advances sync state, and records the account's last successful sync. | N/A |

## Counts

| Category | Sites |
| --- | ---: |
| A | 18 |
| B | 5 |
| C | 1 |
| Total | 24 |

## Required Review Points

No site is classified `UNCERTAIN`, but two B rewrites require deliberate schema
changes before implementation:

| Site | Review requirement |
| --- | --- |
| `playlist-tracks.service.ts:470` | `music_entity_links` currently guarantees one platform per entity, not one Spotify URL per entity type. Add and migrate the external-identity uniqueness constraint before using it as the concurrent create guard. |
| `playlist-tracks.service.ts:584` | Add a durable playlist revision column or equivalent compare-and-set token. `updated_at` alone is an inferior guard because it is both user-visible state and can collide at timestamp precision. |

The production database size and peak write-rate measurements remain
outstanding. They require a human with authorized production access and were not
attempted during this local-only audit.
