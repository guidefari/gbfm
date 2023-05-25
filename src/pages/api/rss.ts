import siteMetadata from '@/src/siteMetadata';
import { NextApiRequest, NextApiResponse } from 'next';
import {allMixes} from'@/contentlayer/generated'
import { useMDXComponent } from 'next-contentlayer/hooks'


export default async (req: NextApiRequest, res: NextApiResponse) => {
console.log('req:', req.headers.host)

  
  try {
      const mixesRSSified = allMixes.map((mix) => {
        const url = `https://${req.headers.host}${mix.url}`;


        return `<item>
          <title>${mix.title}</title>
          <link>${url}</link>
          <guid>${mix.mp3Url}</guid>
          <enclosure url="${mix.mp3Url}" type="audio/mpeg"/>
          <pubDate>${new Date(mix.date).toUTCString()}</pubDate>
          ${
            mix.description &&
            `<description>${mix.description}<br/>
            Get the tracklist and more a immersive experience over at <a href="${url}">${url}</a>
            </description>`
          }
        </item>`;
      })
      .join('');

    // Add urlSet to entire sitemap string
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">
      <channel>
      <title>${siteMetadata.title}</title>
      <description>${siteMetadata.description}</description>
      <link>${siteMetadata.siteUrl}</link>
      <lastBuildDate>${new Date(allMixes[0].date).toUTCString()}</lastBuildDate>
      ${mixesRSSified}
      </channel>
      </rss>`;

    // set response content header to xml
    res.setHeader('Content-Type', 'text/xml');

    return res.status(200).send(sitemap);
  } catch (e: unknown) {
    if (!(e instanceof Error)) {
      throw e;
    }

    return res.status(500).json({ error: e.message || '' });
  }
};
