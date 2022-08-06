import { NextApiRequest, NextApiResponse } from 'next'
import { getAlbumDetails } from '../../lib/spotify'

// eslint-disable-next-line import/no-anonymous-default-export
export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { query } = req
  const id = query?.id

  const response = await getAlbumDetails(id)
  if (response.status > 400) {
    return res.status(200).json({ error: 'Album Not Found' })
  }

  const albumType = response.album_type
  const albumImageUrl = response.images[0].url
  const title = response.name
  const artists = response.artists.map((_artist) => _artist.name).join(', ')
  const albumUrl = response.external_urls.spotify

  return res.status(200).json({ albumType, albumImageUrl, title, artists, albumUrl })
}
