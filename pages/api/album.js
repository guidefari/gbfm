import { getAlbumDetails } from '../../lib/spotify'

// eslint-disable-next-line import/no-anonymous-default-export
export default async (req, res) => {
  // getAlbumId

  const response = await getAlbumDetails('0kDkrsX19g3AT9ECbhy658')
  console.log('response:', response)
  // const { items } = await response.json()

  // const tracks = items.slice(0, 30).map((track) => ({
  //   artist: track.artists.map((_artist) => _artist.name).join(', '),
  //   songUrl: track.external_urls.spotify,
  //   title: track.name,
  //   image: track.album.images[0].url,
  // }))

  return res.status(200).json({ response })
}
