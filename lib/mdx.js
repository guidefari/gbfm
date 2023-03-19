import dynamic from 'next/dynamic'
import Head from 'next/head'

// Custom components/renderers to pass to MDX.
// Since the MDX files aren't loaded by webpack, they have no knowledge of how
// to handle import statements. Instead, you must include components in scope
// here.
export const MDXcomponents = {
  a: dynamic(() => import('@/components/CustomLink')),
  // It also works with dynamically-imported components, which is especially
  // useful for conditionally loading components for certain routes.
  // See the notes in README.md for more details.
  Album: dynamic(() => import('@/components/Album')),
  Track: dynamic(() => import('@/components/Track')),
  Playlist: dynamic(() => import('@/components/Playlist')),
  HorizontalScrollCards: dynamic(() => import('@/components/common/HorizontalScrollCards')),
  Tracklist: dynamic(() => import('@/components/Tracklist')),
  Head,
}

export function dateSortDesc(a, b) {
  if (a > b) return -1
  if (a < b) return 1
  return 0
}
