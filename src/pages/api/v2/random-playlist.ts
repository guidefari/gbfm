import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { PlaylistInput, PlaylistResponse } from '@/src/types';
import { getUsersPlaylists } from '@/lib/spotify';

export type ResponseType = PlaylistResponse["items"]


let playlists: ResponseType
let looping = true

const handler = async (req: NextApiRequest,
  res: NextApiResponse<ResponseType>) => {
  const {
    token: { accessToken, sub },
  } = await getSession({ req });

  playlists = []

  await getBatch({ refresh_token: accessToken, user_id: sub })

  if (!looping) {
    // const random = stringsss[Math.floor(Math.random() * stringsss.length)]
    return res.status(200).send(playlists)
  };
};

export default handler;


const getBatch = async ({ offset, refresh_token, user_id, next_url }: PlaylistInput): Promise<PlaylistResponse> => {
  const response = await getUsersPlaylists({ refresh_token, user_id, offset, next_url })
  const thing: PlaylistResponse = await response.json()
  // const stuffToClean:  = await response.json()
  // const clean = await cleanShitUp(stuffToClean)
  playlists.push(...thing.items)
  if (thing.next) {
    await getBatch({ refresh_token, user_id, next_url: thing.next })
    return
  }

  looping = false
  return
}

// const cleanShitUp = async (stuff: PlaylistResponse) => {
//   console.log('stuff:', stuff)
//   return stuff.items.map((item) => item.external_urls.spotify)
// }

