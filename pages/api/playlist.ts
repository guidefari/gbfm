import { NextApiRequest, NextApiResponse } from 'next'
import { getPlaylistDetails } from '../../lib/spotify'
const { parse } = require('spotify-uri')

// eslint-disable-next-line import/no-anonymous-default-export
export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { query } = req
  let id

  try {
    const isLink = !!new URL(query?.id as string)
    const item = parse(query?.id)
    id = item.id
  } catch (error) {
    id = query?.id
  }

  const response = await getPlaylistDetails(id)
  if (response.status > 400) {
    return res.status(200).json({ error: 'Album Not Found' })
  }

  console.log('response:', response)

  //   ownerId
  //playlist cover image
  // tracks: track[]. track =  Title - Artists, PreviewUrl

  return res.status(200).json({ response })

  //   const albumType = response.album_type
  //   const albumImageUrl = response.images[0].url
  //   const title = response.name
  //   const artists = response.artists.map((_artist) => _artist.name).join(', ')
  //   const albumUrl = response.external_urls.spotify

  //   const number_of_tracks_in_album = response.tracks.items.length
  //   const preview_url_track_number = randomNumberWithinRange(0, number_of_tracks_in_album - 1)
  //   const previewUrl = response.tracks.items[preview_url_track_number].preview_url

  //   return res.status(200).json({ albumType, albumImageUrl, title, artists, albumUrl, previewUrl })
}

function randomNumberWithinRange(myMin, myMax) {
  return Math.floor(Math.random() * (myMax - myMin + 1) + myMin)
}
