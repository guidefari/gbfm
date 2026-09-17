import type {
  SelectMdxCompiledAudio,
  SelectMdxCompiledEditorialPost,
  SelectMdxCompiledMicroPost,
  SelectMdxCompiledRelease
} from '@gbfm/server/schemas'
import {
  makeAudioSiteMetadata,
  makeLabelSiteMetadata,
  makePostSiteMetadata,
  makeProfileSiteMetadata,
  makeReleaseSiteMetadata,
  makeShowSiteMetadata,
  makeStaticSiteMetadata,
  renderDocumentHead,
  STATIC_SITE_METADATA
} from '@gbfm/site-metadata'
import type { MusicLabel, PublicProfile } from './http'

const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null

export const generateSEOHead = renderDocumentHead

export const notFoundHead = (title: string, description: string) => ({
  meta: [
    { title: `${title} | goosebumps.fm` },
    { name: 'description', content: description },
    { name: 'robots', content: 'noindex, nofollow' }
  ]
})

export const privateHead = (title: string) =>
  notFoundHead(title, 'This page is not intended for search results.')

const audioMetadata = (kind: 'mix' | 'track', audio: SelectMdxCompiledAudio, slug: string) =>
  makeAudioSiteMetadata({
    kind,
    slug,
    title: audio.title,
    description: audio.description,
    imageUrl: audio.thumbnailUrl,
    creators: audio.creators?.map((creator) => creator.name) ?? [],
    publishedAt: iso(audio.createdAt),
    modifiedAt: iso(audio.updatedAt),
    audioUrl: audio.url
  })

export const generateMixSEO = (mix: SelectMdxCompiledAudio, slug: string) =>
  audioMetadata('mix', mix, slug)

export const generateTrackSEO = (track: SelectMdxCompiledAudio, slug: string) =>
  audioMetadata('track', track, slug)

export const generatePostSEO = (post: SelectMdxCompiledEditorialPost, slug: string) =>
  makePostSiteMetadata({
    kind: 'editorial',
    slug,
    title: post.title,
    description: post.description,
    imageUrl: post.thumbnailUrl,
    creators: post.creators?.map((creator) => creator.name) ?? [],
    publishedAt: iso(post.createdAt),
    modifiedAt: iso(post.updatedAt)
  })

type MicroPostSEOInput = Pick<
  SelectMdxCompiledMicroPost,
  'title' | 'description' | 'thumbnailUrl' | 'createdAt' | 'updatedAt' | 'creators'
>

export const generateMicroPostSEO = (post: MicroPostSEOInput, slug: string) =>
  makePostSiteMetadata({
    kind: 'tweet',
    slug,
    title: post.title,
    description: post.description,
    imageUrl: post.thumbnailUrl,
    creators: post.creators?.map((creator) => creator.name) ?? [],
    publishedAt: iso(post.createdAt),
    modifiedAt: iso(post.updatedAt)
  })

export const generateLabelSEO = (label: MusicLabel, slug: string) =>
  makeLabelSiteMetadata({
    slug,
    title: label.name,
    description: label.description,
    imageUrl: label.imageUrl,
    creators: label.creators?.map((creator) => creator.name) ?? [],
    publishedAt: iso(label.publishedAt ?? label.createdAt),
    modifiedAt: iso(label.updatedAt)
  })

export const generateReleaseSEO = (release: SelectMdxCompiledRelease, slug: string) =>
  makeReleaseSiteMetadata({
    slug,
    title: release.title,
    description: release.description,
    imageUrl: release.thumbnailUrl,
    creators: [],
    publishedAt: iso(release.releaseDate ?? release.createdAt),
    modifiedAt: iso(release.updatedAt)
  })

type ShowSEOInput = {
  readonly title: string
  readonly description: string | null
  readonly thumbnailUrl: string | null
  readonly bannerImageUrl?: string | null
  readonly createdAt?: Date | string
  readonly updatedAt?: Date | string
  readonly hosts?: ReadonlyArray<{ readonly name: string }>
}

export const generateShowSEO = (show: ShowSEOInput, slug: string) =>
  makeShowSiteMetadata({
    slug,
    title: show.title,
    description: show.description,
    imageUrl: show.bannerImageUrl ?? show.thumbnailUrl,
    creators: show.hosts?.map((host) => host.name) ?? [],
    publishedAt: iso(show.createdAt),
    modifiedAt: iso(show.updatedAt)
  })

export type ResolvedShowData = ShowSEOInput & {
  readonly slug: string
  readonly hosts: ReadonlyArray<{ readonly name: string }>
}

export const generateResolvedShowSEO = (show: ResolvedShowData) => generateShowSEO(show, show.slug)

export const generateProfileSEO = (profile: PublicProfile, username: string) =>
  makeProfileSiteMetadata({
    slug: username,
    title: profile.name,
    imageUrl: profile.image,
    publishedAt: iso(profile.createdAt),
    contributionCount:
      (profile.content?.mixes?.length ?? 0) +
      (profile.content?.shows?.length ?? 0) +
      (profile.content?.editorials?.length ?? 0) +
      (profile.content?.tweets?.length ?? 0)
  })

export const generateStaticPageSEO = makeStaticSiteMetadata

export const STATIC_PAGE_SEO = STATIC_SITE_METADATA
