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
import { Database } from '@/db/layer'
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
  type MusicScrapeInput,
  type MusicScrapeOptions,
  type MusicScraperError
} from '@/services/music-link-scraper.service'
import { S3Service as S3ServiceTag } from '@/services/s3.service'
import { SpotifyImportResolver } from '@/services/spotify-import-resolver.service'
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
import { rescrapeOdesliLinksEffect, scrapeAndCreateEntityEffect } from './scrape.service'
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
    metadata?: InsertMusicEntityLink['metadata']
  ) => Effect.Effect<SelectMusicEntityLink, DatabaseError | NotFoundError>
  readonly deleteLink: (
    entityType: MusicEntityType,
    entityId: string,
    linkId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>

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
  readonly rescrapeOdesliLinks: (
    entityType: ScrapeableMusicEntityType,
    entityId: string,
    options?: MusicScrapeOptions
  ) => Effect.Effect<
    { links: SelectMusicEntityLink[] },
    DatabaseError | NotFoundError | MusicScraperError
  >
}

export const MusicEntityService = Context.Service<MusicEntityService>('MusicEntityService')

export const MusicEntityServiceLayer = Layer.effect(
  MusicEntityService,
  Effect.gen(function* () {
    const scraper = yield* MusicLinkScraperServiceTag
    const spotify = yield* SpotifyServiceTag
    const resolver = yield* SpotifyImportResolver
    const s3 = yield* S3ServiceTag
    const config = yield* ConfigServiceTag
    const db = yield* Database
    const provideDb = Effect.provideService(Database, db)

    return {
      createArtist: (data) => provideDb(createArtistEffect(data)),
      getArtists: () => provideDb(getArtistsEffect()),
      getArtistById: (id) => provideDb(getArtistByIdEffect(id)),
      updateArtist: (id, data) => provideDb(updateArtistEffect(id, data)),
      deleteArtist: (id) => provideDb(deleteArtistEffect(id)),

      createAlbum: (data) => provideDb(createAlbumEffect(data)),
      getAlbums: () => provideDb(getAlbumsEffect()),
      getAlbumById: (id) => provideDb(getAlbumByIdEffect(id)),
      updateAlbum: (id, data) => provideDb(updateAlbumEffect(id, data)),
      deleteAlbum: (id) => provideDb(deleteAlbumEffect(id)),

      createTrack: (data) => provideDb(createTrackEffect(data)),
      getTracks: () => provideDb(getTracksEffect()),
      getTrackById: (id) => provideDb(getTrackByIdEffect(id)),
      updateTrack: (id, data) => provideDb(updateTrackEffect(id, data)),
      deleteTrack: (id) => provideDb(deleteTrackEffect(id)),

      createPlaylist: (data) => provideDb(createPlaylistEffect(data)),
      getPlaylists: () => provideDb(getPlaylistsEffect()),
      getPlaylistById: (id) => provideDb(getPlaylistByIdEffect(id)),
      updatePlaylist: (id, data) => provideDb(updatePlaylistEffect(id, data)),
      deletePlaylist: (id) => provideDb(deletePlaylistEffect(id)),

      createLabel: (data) => provideDb(createLabelEffect(data)),
      getLabels: (includeDrafts) => provideDb(getLabelsEffect(includeDrafts)),
      getLabelById: (id) => provideDb(getLabelByIdEffect(id)),
      getLabelBySlug: (slug) => provideDb(getLabelBySlugEffect(slug)),
      updateLabel: (id, data) => provideDb(updateLabelEffect(id, data)),
      deleteLabel: (id) => provideDb(deleteLabelEffect(id)),

      getArtistsForLabel: (labelId) => provideDb(getArtistsForLabelEffect(labelId)),
      getPublishedArtistsForLabel: (labelId) =>
        provideDb(getPublishedArtistsForLabelEffect(labelId)),
      getAlbumsForLabel: (labelId) => provideDb(getAlbumsForLabelEffect(labelId)),
      getPublishedAlbumsForLabel: (labelId) => provideDb(getPublishedAlbumsForLabelEffect(labelId)),
      getLabelsForArtist: (artistId) => provideDb(getLabelsForArtistEffect(artistId)),
      getLabelsForAlbum: (albumId) => provideDb(getLabelsForAlbumEffect(albumId)),
      affiliateArtistWithLabel: (labelId, artistId) =>
        provideDb(affiliateArtistWithLabelEffect(labelId, artistId)),
      unaffiliateArtistFromLabel: (labelId, artistId) =>
        provideDb(unaffiliateArtistFromLabelEffect(labelId, artistId)),
      affiliateAlbumWithLabel: (labelId, albumId) =>
        provideDb(affiliateAlbumWithLabelEffect(labelId, albumId)),
      unaffiliateAlbumFromLabel: (labelId, albumId) =>
        provideDb(unaffiliateAlbumFromLabelEffect(labelId, albumId)),

      getPlaylistTracks: (playlistId) => provideDb(getPlaylistTracksEffect(playlistId)),
      addTrackToPlaylist: (playlistId, trackId, position) =>
        provideDb(addTrackToPlaylistEffect(playlistId, trackId, position)),
      removeTrackFromPlaylist: (playlistId, trackId) =>
        provideDb(removeTrackFromPlaylistEffect(playlistId, trackId)),
      reorderPlaylistTracks: (playlistId, trackIds) =>
        provideDb(reorderPlaylistTracksEffect(playlistId, trackIds)),
      addSpotifyTrackToPlaylist: (playlistId, spotifyUrl) =>
        provideDb(addSpotifyTrackToPlaylistEffect(spotify, resolver)(playlistId, spotifyUrl)),
      importSpotifyPlaylist: (url, curatorId) =>
        provideDb(
          importSpotifyPlaylistEffect(
            spotify,
            resolver,
            scraper,
            s3,
            config.urls.bucketRouter,
            config.buckets.userContent
          )(url, curatorId)
        ),
      syncPlaylistLinks: (playlistId) =>
        provideDb(
          syncPlaylistLinksEffect(
            spotify,
            scraper,
            s3,
            config.urls.bucketRouter,
            config.buckets.userContent
          )(playlistId)
        ),

      addArtistToAlbum: (albumId, artistId, opts) =>
        provideDb(addArtistToAlbumEffect(albumId, artistId, opts)),
      removeArtistFromAlbum: (albumId, artistId) =>
        provideDb(removeArtistFromAlbumEffect(albumId, artistId)),
      addArtistToTrack: (trackId, artistId, opts) =>
        provideDb(addArtistToTrackEffect(trackId, artistId, opts)),
      removeArtistFromTrack: (trackId, artistId) =>
        provideDb(removeArtistFromTrackEffect(trackId, artistId)),

      getLinksForEntity: (entityType, entityId, statusFilter) =>
        provideDb(getLinksForEntityEffect(entityType, entityId, statusFilter)),
      addLink: (data) => provideDb(addLinkEffect(data)),
      updateLinkStatus: (entityType, entityId, linkId, status, verifiedBy, metadata) =>
        provideDb(
          updateLinkStatusEffect(entityType, entityId, linkId, status, verifiedBy, metadata)
        ),
      deleteLink: (entityType, entityId, linkId) =>
        provideDb(deleteLinkEffect(entityType, entityId, linkId)),
      scrapeAndCreateEntity: (entityType, input) =>
        provideDb(scrapeAndCreateEntityEffect(scraper, entityType, input)),
      rescrapeOdesliLinks: (entityType, entityId, options) =>
        provideDb(rescrapeOdesliLinksEffect(scraper, entityType, entityId, options))
    } satisfies MusicEntityService
  })
)
