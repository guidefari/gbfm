import type { MDXComponents } from 'mdx/types'
import Album from '@/components/Album'
import HorizontalScrollCards from '@/components/common/HorizontalScrollCards'
import Playlist from '@/components/Playlist'
import Track from '@/components/Track'
import Tracklist from '@/components/Tracklist'
import { YoutubeEmbed } from '@/components/YoutubeEmbed'

export const CustomMDXComponents = {
  Album,
  Track,
  Playlist,
  HorizontalScrollCards,
  Tracklist,
  YoutubeEmbed
}
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...CustomMDXComponents,
    ...components
  }
}
