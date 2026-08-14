import { DurableObject } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import type { D1Database } from '@cloudflare/workers-types'
import * as schema from '@/db/exports'
import type { DatabaseClient } from '@/db/layer'
import type { SelectMusicPlaylist } from '@/db/music-entity.schema'
import type { SpotifyImportPlaylist, SpotifyImportTrack } from '@/services/spotify.service'
import {
  canonicalSpotifyImportResolverName,
  resolveSpotifyPlaylist,
  resolveSpotifyTrack,
  type ResolvedSpotifyTrack
} from '@/services/spotify-import-resolver.service'

type SpotifyImportResolverEnv = {
  readonly DB: D1Database
}

type IdentityRow = {
  readonly canonicalName: string
  readonly createdAtMs: number
}

type SpotifyImportResolverHeartbeat = {
  readonly canonicalName: string | null
}

const CREATE_IDENTITY_TABLE = `
  CREATE TABLE IF NOT EXISTS _identity (
    canonical_name TEXT PRIMARY KEY,
    created_at_ms INTEGER NOT NULL
  )
`

export class SpotifyImportResolverDurableObject extends DurableObject<SpotifyImportResolverEnv> {
  private readonly db: DatabaseClient

  constructor(ctx: ConstructorParameters<typeof DurableObject>[0], env: SpotifyImportResolverEnv) {
    super(ctx, env)
    this.db = drizzle(env.DB, { schema })
    void ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(CREATE_IDENTITY_TABLE)
    })
  }

  private getIdentity(): IdentityRow | null {
    const row = [
      ...this.ctx.storage.sql.exec<IdentityRow>(
        'SELECT canonical_name as canonicalName, created_at_ms as createdAtMs FROM _identity LIMIT 1'
      )
    ][0]
    return row ?? null
  }

  private setIdentity(canonicalName: string): void {
    if (this.getIdentity()) return
    this.ctx.storage.sql.exec(
      'INSERT INTO _identity (canonical_name, created_at_ms) VALUES (?, ?)',
      canonicalName,
      Date.now()
    )
  }

  async resolveTrack(track: SpotifyImportTrack): Promise<ResolvedSpotifyTrack> {
    this.setIdentity(canonicalSpotifyImportResolverName('track', track.trackUrl))
    return resolveSpotifyTrack(this.db, track)
  }

  async resolvePlaylist(
    playlist: SpotifyImportPlaylist,
    coverImageUrl: string | null,
    curatorId: string | null | undefined
  ): Promise<SelectMusicPlaylist> {
    this.setIdentity(canonicalSpotifyImportResolverName('playlist', playlist.playlistUrl))
    return resolveSpotifyPlaylist(this.db, playlist, coverImageUrl, curatorId)
  }

  heartbeat(): SpotifyImportResolverHeartbeat {
    return { canonicalName: this.getIdentity()?.canonicalName ?? null }
  }
}
