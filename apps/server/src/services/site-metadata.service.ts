import type { SiteMetadataRouteKind } from '@gbfm/api/site-metadata'
import { Effect } from 'effect'
import {
  makeAudioSiteMetadata,
  makeLabelSiteMetadata,
  makePostSiteMetadata,
  makeProfileSiteMetadata,
  makeReleaseSiteMetadata,
  makeShowSiteMetadata,
  SITE_URL
} from '@gbfm/site-metadata'
import { AudioService } from '@/services/audio.service'
import { ConfigService } from '@/services/config.service'
import { MusicEntityService } from '@/services/music-entity'
import { PostService } from '@/services/post.service'
import { ProfileService, type PublicProfile } from '@/services/profile.service'
import { ReleaseService } from '@/services/release.service'
import { ResolveService } from '@/services/resolve.service'
import { ShowService } from '@/services/show.service'

const iso = (date: Date | null | undefined) => date?.toISOString() ?? null

const metadataFromProfile = (profile: PublicProfile, slug: string, siteUrl: string) => {
  const contributionCount =
    profile.content.mixes.length +
    profile.content.shows.length +
    profile.content.editorials.length +
    profile.content.tweets.length
  return makeProfileSiteMetadata({
    slug,
    title: profile.name,
    imageUrl: profile.image,
    publishedAt: iso(profile.createdAt),
    contributionCount,
    siteUrl
  })
}

const metadataForAudio = (kind: 'mix' | 'track', slug: string, siteUrl: string) =>
  Effect.gen(function* () {
    const service = yield* AudioService
    const audio = yield* service.getBySlug(kind, slug)
    return makeAudioSiteMetadata({
      kind,
      slug,
      title: audio.title,
      description: audio.description,
      imageUrl: audio.thumbnailUrl,
      creators: audio.creators?.map((creator) => creator.name) ?? [],
      publishedAt: iso(audio.createdAt),
      modifiedAt: iso(audio.updatedAt),
      audioUrl: audio.url,
      siteUrl
    })
  })

const metadataForShow = (slug: string, siteUrl: string) =>
  Effect.gen(function* () {
    const service = yield* ShowService
    const show = yield* service.getBySlug(slug)
    const creators = show.hosts?.map((host) => host.name) ?? []
    return makeShowSiteMetadata({
      slug,
      title: show.title,
      description: show.description,
      imageUrl: show.bannerImageUrl ?? show.thumbnailUrl,
      creators,
      publishedAt: iso(show.createdAt),
      modifiedAt: iso(show.updatedAt),
      siteUrl
    })
  })

const metadataForRelease = (slug: string, siteUrl: string) =>
  Effect.gen(function* () {
    const releases = yield* ReleaseService
    const labels = yield* MusicEntityService
    const release = yield* releases.getBySlug(slug)
    const label = yield* labels.getLabelById(release.labelId)
    return makeReleaseSiteMetadata({
      slug,
      title: release.title,
      description: release.description,
      imageUrl: release.thumbnailUrl,
      creators: [label.name],
      publishedAt: iso(release.releaseDate ?? release.createdAt),
      modifiedAt: iso(release.updatedAt),
      siteUrl
    })
  })

const metadataForLabel = (slug: string, siteUrl: string) =>
  Effect.gen(function* () {
    const service = yield* MusicEntityService
    const label = yield* service.getLabelBySlug(slug)
    return makeLabelSiteMetadata({
      slug,
      title: label.name,
      description: label.description,
      imageUrl: label.imageUrl,
      creators: label.creators.map((creator) => creator.name),
      publishedAt: iso(label.publishedAt ?? label.createdAt),
      modifiedAt: iso(label.updatedAt),
      siteUrl
    })
  })

const metadataForProfile = (username: string, siteUrl: string) =>
  Effect.gen(function* () {
    const service = yield* ProfileService
    const profile = yield* service.getPublicProfile(username)
    return metadataFromProfile(profile, username, siteUrl)
  })

const metadataForPost = (kind: 'editorial' | 'tweet' | 'post', slug: string, siteUrl: string) =>
  Effect.gen(function* () {
    const service = yield* PostService
    const post = yield* kind === 'tweet'
      ? service.getMicroPostBySlug(slug)
      : kind === 'editorial'
        ? service.getEditorialBySlug(slug)
        : service.getBySlug(slug)
    const metadataKind = post.type === 'micro' ? 'tweet' : 'editorial'
    const socialImage =
      metadataKind === 'tweet'
        ? (yield* service.getTweetSharePresentation(slug)).images.openGraph
        : null
    return makePostSiteMetadata({
      kind: metadataKind,
      slug,
      title: post.title,
      description: post.description,
      imageUrl: socialImage ?? post.thumbnailUrl,
      imageWidth: socialImage ? 1200 : null,
      imageHeight: socialImage ? 630 : null,
      creators: post.creators?.map((creator) => creator.name) ?? [],
      publishedAt: iso(post.createdAt),
      modifiedAt: iso(post.updatedAt),
      siteUrl
    })
  })

const metadataForResolvedSlug = (slug: string, siteUrl: string) =>
  Effect.gen(function* () {
    const service = yield* ResolveService
    const resolved = yield* service.resolve(slug)
    return resolved.type === 'profile'
      ? metadataFromProfile(resolved.data, slug, siteUrl)
      : yield* metadataForShow(resolved.data.slug, siteUrl)
  })

/** Resolves a published public route into the canonical metadata projection. */
export const resolveSiteMetadata = (kind: SiteMetadataRouteKind, slug: string) =>
  Effect.gen(function* () {
    const config = yield* ConfigService
    const siteUrl = config.urls.frontend || SITE_URL
    switch (kind) {
      case 'mix':
      case 'track':
        return yield* metadataForAudio(kind, slug, siteUrl)
      case 'show':
        return yield* metadataForShow(slug, siteUrl)
      case 'release':
        return yield* metadataForRelease(slug, siteUrl)
      case 'label':
        return yield* metadataForLabel(slug, siteUrl)
      case 'profile':
        return yield* metadataForProfile(slug, siteUrl)
      case 'editorial':
      case 'tweet':
      case 'post':
        return yield* metadataForPost(kind, slug, siteUrl)
      case 'slug':
        return yield* metadataForResolvedSlug(slug, siteUrl)
      default:
        return kind satisfies never
    }
  })
