import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { SITE_URL } from '@/lib/seo'
import type { TweetExportData } from './frames'
import { entityLabelByType, type MusicEntityType } from './entity-labels'
import type { MusicEntityPreview } from './use-music-entity'

export type TweetDownloadPost = {
  title: string | null
  createdAt: Date | string | null
  musicEntityType: string | null
  musicEntityId: string | null
  creators?: ReadonlyArray<{ name: string; username: string | null }>
}

type BuildInput = {
  readonly post: TweetDownloadPost
  readonly slug: string
  readonly avatarUrl: string | null | undefined
  readonly entityType: MusicEntityType | null
  readonly entity: MusicEntityPreview | null | undefined
}

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

export const buildTweetExportData = ({
  post,
  slug,
  avatarUrl,
  entityType,
  entity
}: BuildInput): TweetExportData => {
  const primaryCreator = post.creators?.[0]

  return {
    commentary: post.title ?? '',
    authorName: primaryCreator?.name ?? null,
    username: primaryCreator?.username ?? null,
    avatarUrl: avatarUrl || DEFAULT_IMAGE_URL,
    dateLabel: post.createdAt ? formatDate(post.createdAt) : null,
    entityLabel: entityType ? entityLabelByType[entityType] : null,
    entityTitle: entity?.title ?? null,
    entityArtists: entity?.artistNames?.length ? entity.artistNames.join(', ') : null,
    coverImageUrl: entity?.coverImageUrl ?? null,
    url: `${SITE_URL}/tweet/${slug}`
  }
}
