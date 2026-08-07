#!/usr/bin/env bun
/**
 * Backfills musicEntityType/musicEntityId on draft posts imported from
 * Bluesky that don't have a resolved music entity yet — typically because
 * the archive importer's inline scrape attempt failed at import time (e.g.
 * Odesli's Bandcamp resolver returning could_not_fetch_entity_data).
 *
 * Re-extracts a candidate music URL from each draft's content, re-runs the
 * scrape pipeline (now with Bandcamp + Spotify-search fallback), and writes
 * the resolved entity back onto the post.
 *
 * Usage:
 *   bun run scripts/backfill-draft-music-entities.ts            # dry run, report only
 *   bun run scripts/backfill-draft-music-entities.ts --apply    # write changes
 */

import { isNull, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '../src/db'
import { postsTable } from '../src/db/post.schema'
import { AppLayer } from '../src/runtime/services'
import { MusicEntityService } from '../src/services/music-entity'
import { MusicLinkScraperService } from '../src/services/music-link-scraper.service'

const musicHosts = new Set([
  'open.spotify.com',
  'music.apple.com',
  'soundcloud.com',
  'youtube.com',
  'youtu.be',
  'music.youtube.com',
  'tidal.com',
  'deezer.com',
  'audiomack.com'
])

const isMusicHost = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return musicHosts.has(host) || host.endsWith('.bandcamp.com')
  } catch {
    return false
  }
}

const URL_REGEX = /https?:\/\/[^\s)]+/g

const extractCandidateUrl = (content: string): string | undefined => {
  const matches = content.match(URL_REGEX) ?? []
  return matches.find(isMusicHost)
}

const entityTypeForUrl = (url: string): 'album' | 'track' =>
  /\/album(?:s)?\//i.test(url) ? 'album' : 'track'

const apply = process.argv.includes('--apply')

// Odesli rate-limits aggressively on repeated calls and gives no Retry-After
// hint, so we space requests out ourselves rather than discover the limit
// via a burst of 429s.
const THROTTLE = '1500 millis'

type DraftOutcome = 'resolved' | 'skippedNoUrl' | 'failed'

const processDraft = (
  musicEntities: MusicEntityService,
  scraper: MusicLinkScraperService,
  draft: { id: string; content: string | null }
): Effect.Effect<DraftOutcome> =>
  Effect.gen(function* () {
    const candidateUrl = extractCandidateUrl(draft.content ?? '')
    if (!candidateUrl) return 'skippedNoUrl' as const

    yield* Effect.sleep(THROTTLE)

    const scraped = yield* scraper.scrape({ url: candidateUrl })
    if (!scraped.entityMeta) {
      console.log(`✗ ${draft.id} — no metadata resolved for ${candidateUrl}`)
      return 'failed' as const
    }

    const entityType =
      scraped.entityMeta.type === 'album' ? 'album' : entityTypeForUrl(candidateUrl)

    const outcome = yield* Effect.catch(
      musicEntities.scrapeAndCreateEntity(entityType, { url: candidateUrl }),
      (err) =>
        Effect.andThen(
          Effect.logWarning(`scrapeAndCreateEntity failed for ${draft.id}: ${err.message}`),
          Effect.succeed(null)
        )
    )

    if (!outcome) {
      console.log(`✗ ${draft.id} — could not create entity for ${candidateUrl}`)
      return 'failed' as const
    }

    console.log(
      `✓ ${draft.id} — ${entityType}:${outcome.entity.id} "${scraped.entityMeta.title}" by ${scraped.entityMeta.artistName} (${outcome.links.length} links)`
    )

    if (apply) {
      yield* Effect.promise(() =>
        db
          .update(postsTable)
          .set({ musicEntityType: entityType, musicEntityId: outcome.entity.id })
          .where(eq(postsTable.id, draft.id))
      )
    }

    return 'resolved' as const
  })

const program = Effect.gen(function* () {
  const musicEntities = yield* MusicEntityService
  const scraper = yield* MusicLinkScraperService

  const drafts = yield* Effect.promise(() =>
    db
      .select({ id: postsTable.id, content: postsTable.content })
      .from(postsTable)
      .where(isNull(postsTable.musicEntityId))
  )

  console.log(`Found ${drafts.length} posts without a resolved music entity.\n`)

  const outcomes = yield* Effect.forEach(
    drafts,
    (draft) => processDraft(musicEntities, scraper, draft),
    { concurrency: 1 }
  )

  const resolved = outcomes.filter((o) => o === 'resolved').length
  const skippedNoUrl = outcomes.filter((o) => o === 'skippedNoUrl').length
  const failed = outcomes.filter((o) => o === 'failed').length

  console.log(
    `\n${apply ? 'Applied' : 'Would apply'}: ${resolved} resolved, ${skippedNoUrl} skipped (no music URL), ${failed} failed.`
  )
  if (!apply) {
    console.log('Dry run — pass --apply to write changes.')
  }
})

Effect.runPromise(program.pipe(Effect.provide(AppLayer)) as Effect.Effect<void, never, never>)
