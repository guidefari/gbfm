import { GenericAndMaybeLegacyError, TrackAPIResponse } from '@/src/types'
import { NextApiRequest, NextApiResponse } from 'next'
import { getTrackDetails } from '../../lib/spotify'
import * as Sentry from '@sentry/nextjs'

const { parse } = require('spotify-uri')

// eslint-disable-next-line import/no-anonymous-default-export
export default async (
  req: NextApiRequest,
  res: NextApiResponse<TrackAPIResponse | GenericAndMaybeLegacyError>
) => {
  const { query } = req
  let id

  try {
    const isLink = !!new URL(query?.id as string)
    const item = parse(query?.id)
    id = item.id
  } catch (error) {
    id = query?.id
  }

  try {

    const response = await getTrackDetails(id)
    if (response.status > 400) {
      return res.status(response.status).json({ error: 'Track Not Found' })
    }

    const albumType = response.album.album_type
    const albumImageUrl = response.album.images[0].url
    const title = response.name
    const artists = response.artists.map((_artist) => _artist.name).join(', ')
    const trackUrl = response.external_urls.spotify
    const previewUrl = response.preview_url

    return res.status(200).json({ albumType, albumImageUrl, title, artists, trackUrl, previewUrl })
  } catch (error) {
    Sentry.captureException(error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
