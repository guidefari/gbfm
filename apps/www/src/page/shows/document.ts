import { GetAllShowsResponse, GetShowEpisodesResponse } from '@gbfm/api/shows'
import { RichContentDocument } from '@gbfm/rich-content/schema'
import { Schema } from 'effect'

/** The public show browser preserves selection in the URL and distinguishes failed episode reads from empty shows. */
export const ShowsDocument = Schema.Struct({
  shows: GetAllShowsResponse.fields.data,
  selectedSlug: Schema.NullOr(Schema.String),
  episodes: Schema.NullOr(GetShowEpisodesResponse),
  richContent: Schema.optional(RichContentDocument),
})

export type ShowsDocument = typeof ShowsDocument.Type

export type Episode = (typeof GetShowEpisodesResponse.Type.data)[number]

export type ShowsPlayback<M> = {
  readonly prefetch: (href: string) => M
  readonly play: (episode: Episode) => M
  readonly toggle: M
  readonly currentId: string | null
  readonly isPlaying: boolean
}

const mastheadArtSizes = '(min-width: 640px) 224px, 60vw'

const episodeArtSizes = '64px'

/** The artwork a show page paints first, for warming the image cache before navigating to it. */
export const showImages = (document: ShowsDocument) => [
  ...document.shows.flatMap((show) =>
    show.slug === document.selectedSlug
      ? [{ src: show.thumbnailUrl, sizes: mastheadArtSizes }]
      : [],
  ),
  ...(document.episodes?.data ?? [])
    .slice(0, 8)
    .map((episode) => ({ src: episode.thumbnailUrl, sizes: episodeArtSizes })),
]
