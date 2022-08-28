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

  const number_of_tracks_in_album = response.tracks.items.length
  const preview_url_track_number = randomNumberWithinRange(0, number_of_tracks_in_album - 1)
  const previewUrl = response.tracks.items[preview_url_track_number].preview_url

  return res.status(200).json({ albumType, albumImageUrl, title, artists, albumUrl, previewUrl })
}

function randomNumberWithinRange(myMin, myMax) {
  return Math.floor(Math.random() * (myMax - myMin + 1) + myMin)
}
