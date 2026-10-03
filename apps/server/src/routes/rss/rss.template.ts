const SITE_URL = 'https://goosebumps.fm'

const FEED_URL = 'https://api.goosebumps.fm/rss.xml'

const FEED_IMAGE_URL = 'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'

/** Database projection required to render one published mix in the RSS feed. */
export interface RssMixEntry {
  readonly slug: string
  readonly title: string
  readonly description: string | null
  readonly url: string
  readonly createdAt: Date | string
}

function encodeXML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const rssItemXml = (mix: RssMixEntry): string => {
  const link = `${SITE_URL}/mixes/${encodeURIComponent(mix.slug)}`

  return `    <item>
      <title>${encodeXML(mix.title)}</title>
      <link>${encodeXML(link)}</link>
      <guid isPermaLink="true">${encodeXML(link)}</guid>
      <pubDate>${new Date(mix.createdAt).toUTCString()}</pubDate>
      <description>${encodeXML(mix.description ?? '')}</description>
      <enclosure url="${encodeXML(mix.url)}" type="audio/mpeg" />
    </item>`
}

/** Renders published mixes as a valid RSS 2.0 podcast feed. */
export const rssFeedXml = (mixes: ReadonlyArray<RssMixEntry>): string => {
  const items = mixes
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(rssItemXml)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Goosebumps.fm Mixes</title>
    <link>${SITE_URL}</link>
    <description>Curated mixes from the Goosebumps.fm archive</description>
    <language>en-gb</language>
    <image>
      <url>${FEED_IMAGE_URL}</url>
      <title>Goosebumps.fm Mixes</title>
      <link>${SITE_URL}</link>
    </image>
    <itunes:image href="${FEED_IMAGE_URL}" />
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`
}
