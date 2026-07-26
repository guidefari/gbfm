import type { LinkStatus } from '@gbfm/core/status'
import { Context, Effect, Layer } from 'effect'
import type {
  InsertMusicEntityLink,
  MusicEntityType,
  SelectMusicAlbum,
  SelectMusicArtist,
  SelectMusicEntityLink,
  SelectMdxCompiledMusicLabel,
  SelectMusicLabel,
  SelectMusicPlaylist,
  SelectMusicPlaylistTrack,
  SelectMusicTrack
} from '@/db/music-entity.schema'
import type { DatabaseError, NotFoundError, SpotifyError } from '@/errors'
import { ConfigService as ConfigServiceTag } from '@/services/config.service'
import { DatabaseService } from '@/services/database.service'
import {
  affiliateAlbumWithLabelEffect,
  affiliateArtistWithLabelEffect,
  getAlbumsForLabelEffect,
  getArtistsForLabelEffect,
  getLabelsForAlbumEffect,
  getLabelsForArtistEffect,
  getPublishedAlbumsForLabelEffect,
  getPublishedArtistsForLabelEffect,
  unaffiliateAlbumFromLabelEffect,
  unaffiliateArtistFromLabelEffect
} from './label-affiliation.service'
import {
  type CreateLabelInput,
  createLabelEffect,
  deleteLabelEffect,
  getLabelByIdEffect,
  getLabelBySlugEffect,
  getLabelsEffect,
  updateLabelEffect
} from './label.service'
import {
  MusicLinkScraperService as MusicLinkScraperServiceTag,
  type MusicScrapeInput
} from '@/services/music-link-scraper.service'
import { S3Service as S3ServiceTag } from '@/services/s3.service'
import { SpotifyService as SpotifyServiceTag } from '@/services/spotify.service'

import {
  addArtistToAlbumEffect,
  type CreateAlbumInput,
  createAlbumEffect,
  deleteAlbumEffect,
  getAlbumByIdEffect,
  getAlbumsEffect,
  removeArtistFromAlbumEffect,
  updateAlbumEffect
} from './album.service'
import {
  type CreateArtistInput,
  createArtistEffect,
  deleteArtistEffect,
  getArtistByIdEffect,
  getArtistsEffect,
  updateArtistEffect
} from './artist.service'
import {
  addLinkEffect,
  deleteLinkEffect,
  getLinksForEntityEffect,
  getPendingLinksEffect,
  updateLinkStatusEffect
} from './link.service'
import {
  type CreatePlaylistInput,
  createPlaylistEffect,
  deletePlaylistEffect,
  getPlaylistByIdEffect,
  getPlaylistsEffect,
  updatePlaylistEffect
} from './playlist.service'
import {
  addSpotifyTrackToPlaylistEffect,
  addTrackToPlaylistEffect,
  getPlaylistTracksEffect,
  importSpotifyPlaylistEffect,
  removeTrackFromPlaylistEffect,
  reorderPlaylistTracksEffect,
  syncPlaylistLinksEffect
} from './playlist-tracks.service'
import { scrapeAndCreateEntityEffect } from './scrape.service'
import {
  addArtistToTrackEffect,
  type CreateTrackInput,
  createTrackEffect,
  deleteTrackEffect,
  getTrackByIdEffect,
  getTracksEffect,
  removeArtistFromTrackEffect,
  updateTrackEffect
} from './track.service'

export type {
  CreateAlbumInput,
  CreateArtistInput,
  CreateLabelInput,
  CreatePlaylistInput,
  CreateTrackInput
}

type ScrapeableMusicEntityType = Exclude<MusicEntityType, 'label'>

export interface MusicEntityService {
  readonly createArtist: (
    data: CreateArtistInput
  ) => Effect.Effect<SelectMusicArtist, DatabaseError>
  readonly getArtists: () => Effect.Effect<SelectMusicArtist[], DatabaseError>
  readonly getArtistById: (
    id: string
  ) => Effect.Effect<SelectMusicArtist, DatabaseError | NotFoundError>
  readonly updateArtist: (
    id: string,
    data: Partial<CreateArtistInput>
  ) => Effect.Effect<SelectMusicArtist, DatabaseError | NotFoundError>
  readonly deleteArtist: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>

  readonly createAlbum: (data: CreateAlbumInput) => Effect.Effect<SelectMusicAlbum, DatabaseError>
  readonly getAlbums: () => Effect.Effect<SelectMusicAlbum[], DatabaseError>
  readonly getAlbumById: (
    id: string
  ) => Effect.Effect<SelectMusicAlbum, DatabaseError | NotFoundError>
  readonly updateAlbum: (
    id: string,
    data: Partial<CreateAlbumInput>
  ) => Effect.Effect<SelectMusicAlbum, DatabaseError | NotFoundError>
  readonly deleteAlbum: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>

  readonly createTrack: (data: CreateTrackInput) => Effect.Effect<SelectMusicTrack, DatabaseError>
  readonly getTracks: () => Effect.Effect<SelectMusicTrack[], DatabaseError>
  readonly getTrackById: (
    id: string
  ) => Effect.Effect<SelectMusicTrack, DatabaseError | NotFoundError>
  readonly updateTrack: (
    id: string,
    data: Partial<CreateTrackInput>
  ) => Effect.Effect<SelectMusicTrack, DatabaseError | NotFoundError>
  readonly deleteTrack: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>

  readonly createPlaylist: (
    data: CreatePlaylistInput
  ) => Effect.Effect<SelectMusicPlaylist, DatabaseError>
  readonly getPlaylists: () => Effect.Effect<
    (SelectMusicPlaylist & { spotifyUrl: string | null })[],
    DatabaseError
  >
  readonly getPlaylistById: (
    id: string
  ) => Effect.Effect<
    SelectMusicPlaylist & { spotifyUrl: string | null },
    DatabaseError | NotFoundError
  >
  readonly updatePlaylist: (
    id: string,
    data: Partial<CreatePlaylistInput>
  ) => Effect.Effect<SelectMusicPlaylist, DatabaseError | NotFoundError>
  readonly deletePlaylist: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>

  readonly createLabel: (data: CreateLabelInput) => Effect.Effect<SelectMusicLabel, DatabaseError>
  readonly getLabels: (includeDrafts: boolean) => Effect.Effect<SelectMusicLabel[], DatabaseError>
  readonly getLabelById: (
    id: string
  ) => Effect.Effect<SelectMusicLabel, DatabaseError | NotFoundError>
  readonly getLabelBySlug: (
    slug: string
  ) => Effect.Effect<SelectMdxCompiledMusicLabel, DatabaseError | NotFoundError>
  readonly updateLabel: (
    id: string,
    data: Partial<CreateLabelInput>
  ) => Effect.Effect<SelectMusicLabel, DatabaseError | NotFoundError>
  readonly deleteLabel: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>

  readonly getArtistsForLabel: (
    labelId: string
  ) => Effect.Effect<SelectMusicArtist[], DatabaseError>
  readonly getPublishedArtistsForLabel: (
    labelId: string
  ) => Effect.Effect<SelectMusicArtist[], DatabaseError>
  readonly getAlbumsForLabel: (labelId: string) => Effect.Effect<SelectMusicAlbum[], DatabaseError>
  readonly getPublishedAlbumsForLabel: (
    labelId: string
  ) => Effect.Effect<SelectMusicAlbum[], DatabaseError>
  readonly getLabelsForArtist: (
    artistId: string
  ) => Effect.Effect<SelectMusicLabel[], DatabaseError>
  readonly getLabelsForAlbum: (albumId: string) => Effect.Effect<SelectMusicLabel[], DatabaseError>
  readonly affiliateArtistWithLabel: (
    labelId: string,
    artistId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>
  readonly unaffiliateArtistFromLabel: (
    labelId: string,
    artistId: string
  ) => Effect.Effect<void, DatabaseError>
  readonly affiliateAlbumWithLabel: (
    labelId: string,
    albumId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>
  readonly unaffiliateAlbumFromLabel: (
    labelId: string,
    albumId: string
  ) => Effect.Effect<void, DatabaseError>

  readonly getPlaylistTracks: (playlistId: string) => Effect.Effect<
    Array<{
      track: SelectMusicTrack
      position: number
      addedAt: Date
      links: SelectMusicEntityLink[]
    }>,
    DatabaseError
  >
  readonly addTrackToPlaylist: (
    playlistId: string,
    trackId: string,
    position: number
  ) => Effect.Effect<SelectMusicPlaylistTrack, DatabaseError>
  readonly removeTrackFromPlaylist: (
    playlistId: string,
    trackId: string
  ) => Effect.Effect<void, DatabaseError>
  readonly reorderPlaylistTracks: (
    playlistId: string,
    trackIds: string[]
  ) => Effect.Effect<void, DatabaseError>
  readonly addSpotifyTrackToPlaylist: (
    playlistId: string,
    spotifyUrl: string
  ) => Effect.Effect<
    { trackId: string; position: number; created: boolean },
    DatabaseError | SpotifyError
  >
  readonly importSpotifyPlaylist: (
    url: string,
    curatorId?: string | null
  ) => Effect.Effect<
    {
      playlist: SelectMusicPlaylist
      trackCount: number
      createdTrackCount: number
      reusedTrackCount: number
    },
    DatabaseError | SpotifyError
  >
  readonly syncPlaylistLinks: (
    playlistId: string
  ) => Effect.Effect<{ playlistId: string; queuedTrackCount: number }, DatabaseError | SpotifyError>

  readonly addArtistToAlbum: (
    albumId: string,
    artistId: string,
    opts?: { role?: string; displayOrder?: number }
  ) => Effect.Effect<void, DatabaseError>
  readonly removeArtistFromAlbum: (
    albumId: string,
    artistId: string
  ) => Effect.Effect<void, DatabaseError>
  readonly addArtistToTrack: (
    trackId: string,
    artistId: string,
    opts?: { role?: string; displayOrder?: number }
  ) => Effect.Effect<void, DatabaseError>
  readonly removeArtistFromTrack: (
    trackId: string,
    artistId: string
  ) => Effect.Effect<void, DatabaseError>

  readonly getLinksForEntity: (
    entityType: MusicEntityType,
    entityId: string,
    statusFilter?: LinkStatus
  ) => Effect.Effect<SelectMusicEntityLink[], DatabaseError>
  readonly addLink: (
    data: InsertMusicEntityLink
  ) => Effect.Effect<SelectMusicEntityLink, DatabaseError>
  readonly updateLinkStatus: (
    entityType: MusicEntityType,
    entityId: string,
    linkId: string,
    status: LinkStatus,
    verifiedBy?: string,
    metadata?: Record<string, unknown>
  ) => Effect.Effect<SelectMusicEntityLink, DatabaseError | NotFoundError>
  readonly deleteLink: (
    entityType: MusicEntityType,
    entityId: string,
    linkId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>
  readonly getPendingLinks: (opts?: {
    limit?: number
    offset?: number
  }) => Effect.Effect<SelectMusicEntityLink[], DatabaseError>

  readonly scrapeAndCreateEntity: (
    entityType: ScrapeableMusicEntityType,
    input: MusicScrapeInput
  ) => Effect.Effect<
    {
      entity: SelectMusicArtist | SelectMusicAlbum | SelectMusicTrack | SelectMusicPlaylist
      links: SelectMusicEntityLink[]
    },
    DatabaseError
  >
}

export const MusicEntityService = Context.Service<MusicEntityService>('MusicEntityService')

export const MusicEntityServiceLive = Layer.effect(
  MusicEntityService,
  Effect.gen(function* () {
    const scraper = yield* MusicLinkScraperServiceTag
    const spotify = yield* SpotifyServiceTag
    const s3 = yield* S3ServiceTag
    const config = yield* ConfigServiceTag
    const { db } = yield* DatabaseService

    return {
      createArtist: createArtistEffect(db),
      getArtists: getArtistsEffect(db),
      getArtistById: getArtistByIdEffect(db),
      updateArtist: updateArtistEffect(db),
      deleteArtist: deleteArtistEffect(db),

      createAlbum: createAlbumEffect(db),
      getAlbums: getAlbumsEffect(db),
      getAlbumById: getAlbumByIdEffect(db),
      updateAlbum: updateAlbumEffect(db),
      deleteAlbum: deleteAlbumEffect(db),

      createTrack: createTrackEffect(db),
      getTracks: getTracksEffect(db),
      getTrackById: getTrackByIdEffect(db),
      updateTrack: updateTrackEffect(db),
      deleteTrack: deleteTrackEffect(db),

      createPlaylist: createPlaylistEffect(db),
      getPlaylists: getPlaylistsEffect(db),
      getPlaylistById: getPlaylistByIdEffect(db),
      updatePlaylist: updatePlaylistEffect(db),
      deletePlaylist: deletePlaylistEffect(db),

      createLabel: createLabelEffect(db),
      getLabels: getLabelsEffect(db),
      getLabelById: getLabelByIdEffect(db),
      getLabelBySlug: getLabelBySlugEffect(db),
      updateLabel: updateLabelEffect(db),
      deleteLabel: deleteLabelEffect(db),

      getArtistsForLabel: getArtistsForLabelEffect(db),
      getPublishedArtistsForLabel: getPublishedArtistsForLabelEffect(db),
      getAlbumsForLabel: getAlbumsForLabelEffect(db),
      getPublishedAlbumsForLabel: getPublishedAlbumsForLabelEffect(db),
      getLabelsForArtist: getLabelsForArtistEffect(db),
      getLabelsForAlbum: getLabelsForAlbumEffect(db),
      affiliateArtistWithLabel: affiliateArtistWithLabelEffect(db),
      unaffiliateArtistFromLabel: unaffiliateArtistFromLabelEffect(db),
      affiliateAlbumWithLabel: affiliateAlbumWithLabelEffect(db),
      unaffiliateAlbumFromLabel: unaffiliateAlbumFromLabelEffect(db),

      getPlaylistTracks: getPlaylistTracksEffect(db),
      addTrackToPlaylist: addTrackToPlaylistEffect(db),
      removeTrackFromPlaylist: removeTrackFromPlaylistEffect(db),
      reorderPlaylistTracks: reorderPlaylistTracksEffect(db),
      addSpotifyTrackToPlaylist: addSpotifyTrackToPlaylistEffect(db, spotify),
      importSpotifyPlaylist: importSpotifyPlaylistEffect(
        db,
        spotify,
        scraper,
        s3,
        config.urls.bucketRouter,
        config.buckets.userContent
      ),
      syncPlaylistLinks: syncPlaylistLinksEffect(
        db,
        spotify,
        scraper,
        s3,
        config.urls.bucketRouter,
        config.buckets.userContent
      ),

      addArtistToAlbum: addArtistToAlbumEffect(db),
      removeArtistFromAlbum: removeArtistFromAlbumEffect(db),
      addArtistToTrack: addArtistToTrackEffect(db),
      removeArtistFromTrack: removeArtistFromTrackEffect(db),

      getLinksForEntity: getLinksForEntityEffect(db),
      addLink: addLinkEffect(db),
      updateLinkStatus: updateLinkStatusEffect(db),
      deleteLink: deleteLinkEffect(db),
      getPendingLinks: getPendingLinksEffect(db),
      scrapeAndCreateEntity: scrapeAndCreateEntityEffect(db, scraper)
    } satisfies MusicEntityService
  })
)
