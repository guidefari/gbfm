import { HorizontalScrollCards, YoutubeEmbed } from '@gbfm/ui'
import type { MDXComponents } from 'mdx/types'
import Album from '@/components/Album'
import Playlist from '@/components/Playlist'
import Track from '@/components/Track'
import Tracklist from '@/components/Tracklist'
import { ExternalMedia } from '@/components/editorial/ExternalMedia'

export const CustomMDXComponents = {
  Album,
  Track,
  Playlist,
  HorizontalScrollCards,
  Tracklist,
  YoutubeEmbed,
  ExternalMedia
}
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...CustomMDXComponents,
    ...components
  }
}
