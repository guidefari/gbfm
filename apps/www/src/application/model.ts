import { AudioResponse } from '@gbfm/api/audio'
import { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import { MicroPostScreenResponse } from '@gbfm/api/post'
import { PublicProfileResponse } from '@gbfm/api/profile'
import { ReleaseResponse } from '@gbfm/api/release'
import { RichContentDocument } from '@gbfm/rich-content/schema'
import { SiteMetadata } from '@gbfm/site-metadata'
import { type HashMap, Schema } from 'effect'
import { AsyncData } from 'foldkit'

import * as Creator from '../creator'
import * as Dashboard from '../dashboard'
import { DashboardDocument } from '../dashboard/document'
import { ShowsDocument } from '../page/shows'
import * as Player from '../player'
import * as PublicActions from '../public-actions'
import * as Search from '../search'
import { Route } from './route'

export const Principal = Schema.Struct({
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
  username: Schema.NullOr(Schema.String),
  role: Schema.NullOr(Schema.String),
})

export type Principal = typeof Principal.Type

export const ContentItem = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  imageUrl: Schema.NullOr(Schema.String),
  href: Schema.String,
  meta: Schema.NullOr(Schema.String),
  content: Schema.String,
  richContent: Schema.NullOr(RichContentDocument),
  audioUrl: Schema.NullOr(Schema.String),
  audioType: Schema.NullOr(AudioResponse.fields.type),
  creators: AudioResponse.fields.creators,
  tags: ReleaseResponse.fields.tags,
  streamingLinks: ReleaseResponse.fields.streamingLinks,
})

export type ContentItem = typeof ContentItem.Type

export const Flags = Schema.Struct({
  url: Schema.String,
  status: Schema.Number,
  principal: Schema.NullOr(Principal),
  items: Schema.Array(ContentItem),
  title: Schema.String,
  description: Schema.String,
  requestId: Schema.String,
  renderedAt: Schema.Number,
  skipSeen: Schema.Boolean,
  tweet: Schema.NullOr(MicroPostScreenResponse),
  neighbours: Schema.NullOr(MicroPostNeighboursResponse),
  dashboard: Schema.NullOr(DashboardDocument),
  profile: Schema.NullOr(PublicProfileResponse),
  shows: Schema.NullOr(ShowsDocument),
  changelog: Schema.NullOr(RichContentDocument),
  publicAction: Schema.NullOr(PublicActions.Document),
  metadata: Schema.NullOr(SiteMetadata),
  failure: Schema.NullOr(Schema.String),
})

export type Flags = typeof Flags.Type

/** Stale-while-revalidate page data per URL, so revisits render immediately while a fresh copy loads. */
export const PageData = AsyncData.Schema(Flags, Schema.String)

export type PageCache = HashMap.HashMap<string, AsyncData.AsyncData<Flags, string>>

export const Model = Schema.Struct({
  route: Route,
  flags: Flags,
  menuOpen: Schema.Boolean,
  search: Search.Model,
  skipSeen: Schema.Boolean,
  loading: Schema.Boolean,
  pendingPath: Schema.NullOr(Schema.String),
  pageCache: Schema.HashMap(Schema.String, PageData.schema),
  interactive: Schema.Boolean,
  navigationId: Schema.Number,
  error: Schema.NullOr(Schema.String),
  repliesStatus: Schema.Literals(['loading', 'ready', 'error']),
  player: Player.Model,
  publicAction: PublicActions.Model,
  creator: Creator.Model,
  dashboard: Dashboard.Model,
})

export type Model = typeof Model.Type
