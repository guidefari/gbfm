import type {
  SelectMdxCompiledAudio,
  SelectMdxCompiledLabel,
  SelectMdxCompiledRelease
} from '@gbfm/vps/schemas'

export const SITE_URL = 'https://goosebumps.fm'
export const DEFAULT_OG_IMAGE =
  'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'

export interface SEOHeadData {
  title: string
  description: string
  url: string
  image?: string
  type?: string
  audioUrl?: string
}

export function generateSEOMeta(data: SEOHeadData) {
  const {
    title,
    description,
    url,
    image = DEFAULT_OG_IMAGE,
    type = 'website',
    audioUrl
  } = data

  const meta = [
    {
      title: `${title} | goosebumps.fm`
    },
    {
      name: 'description',
      content: description
    },
    {
      property: 'og:type',
      content: type
    },
    {
      property: 'og:title',
      content: `${title} | goosebumps.fm`
    },
    {
      property: 'og:description',
      content: description
    },
    {
      property: 'og:url',
      content: url
    },
    {
      property: 'og:site_name',
      content: 'goosebumps.fm'
    },
    {
      property: 'og:image',
      content: image
    },
    {
      property: 'og:image:width',
      content: '1200'
    },
    {
      property: 'og:image:height',
      content: '630'
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image'
    },
    {
      name: 'twitter:title',
      content: `${title} | goosebumps.fm`
    },
    {
      name: 'twitter:description',
      content: description
    },
    {
      name: 'twitter:image',
      content: image
    }
  ]

  // Add audio-specific tags for music content
  if (audioUrl && (type === 'music.song' || type === 'music.album')) {
    meta.push({
      property: 'og:audio',
      content: audioUrl
    })
  }

  return meta
}

export function generateMixSEO(
  mix: SelectMdxCompiledAudio,
  mixId: string
): SEOHeadData {
  const title = mix.title || mixId
  const description = mix.description || `Listen to ${title} on goosebumps.fm`
  const url = `${SITE_URL}/mixes/${mixId}`
  const image = mix.thumbnailUrl || DEFAULT_OG_IMAGE

  return {
    title,
    description,
    url,
    image,
    type: 'music.song',
    audioUrl: mix.url || undefined
  }
}

export function generateTrackSEO(
  track: SelectMdxCompiledAudio,
  trackId: string
): SEOHeadData {
  const title = track.title || trackId
  const description = track.description || `Listen to ${title} on goosebumps.fm`
  const url = `${SITE_URL}/tracks/${trackId}`
  const image = track.thumbnailUrl || DEFAULT_OG_IMAGE

  return {
    title,
    description,
    url,
    image,
    type: 'music.song',
    audioUrl: track.url || undefined
  }
}

export function generateLabelSEO(
  label: SelectMdxCompiledLabel,
  labelSlug: string
): SEOHeadData {
  const title = label.title || labelSlug
  const description =
    label.description || `Explore music from ${title} on goosebumps.fm`
  const url = `${SITE_URL}/labels/${labelSlug}`
  const image = label.thumbnailUrl || DEFAULT_OG_IMAGE

  return {
    title,
    description,
    url,
    image,
    type: 'website' // Labels are more like organization pages
  }
}

export function generateReleaseSEO(
  release: SelectMdxCompiledRelease,
  slug: string
): SEOHeadData {
  const title = release.title || slug
  const description =
    release.description || `Discover ${title} on goosebumps.fm`
  const url = `${SITE_URL}/releases/${slug}`
  const image = release.thumbnailUrl || DEFAULT_OG_IMAGE

  return {
    title,
    description,
    url,
    image,
    type: 'music.album'
  }
}

export function generateStaticPageSEO(
  title: string,
  description: string,
  path: string
): SEOHeadData {
  return {
    title,
    description,
    url: `${SITE_URL}${path}`,
    type: 'website'
  }
}

export const STATIC_PAGE_SEO = {
  home: generateStaticPageSEO(
    'goosebumps.fm',
    'Discover curated music mixes, tracks, and releases. Your destination for deep house, electronic, and soulful sounds.',
    '/'
  ),
  mixes: generateStaticPageSEO(
    'Browse Mixes',
    'Explore curated DJ mixes featuring deep house, electronic, ambient, and more. Stream or download your favorites.',
    '/mixes'
  ),
  tracks: generateStaticPageSEO(
    'All Tracks',
    'Browse and stream individual tracks, mixes, and audio content on goosebumps.fm.',
    '/tracks'
  ),
  labels: generateStaticPageSEO(
    'Record Labels',
    'Discover independent record labels and their music catalogs on goosebumps.fm.',
    '/labels'
  ),
  dashboard: generateStaticPageSEO(
    'Dashboard',
    'Your personal dashboard on goosebumps.fm. Access your favorites, recent plays, and reminders.',
    '/dashboard'
  )
} as const
