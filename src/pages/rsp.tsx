import { SpinningCircleLoaderThingy } from '@/components/common/icons'
import fetcher from '@/lib/fetcher'
import clsx from 'clsx'
import { signIn, signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import { useRouter } from 'next/router'
import useSWR from 'swr'
import type { ResponseType as RandomPlaylistApiResponse } from './api/v2/random-playlist'

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */

  interface Session {
    token: {
      name: string
      email: string
      picture: string
      sub: string
      accessToken: string
      iat: number
      exp: number
      jti: string
    }
  }
}

export default function RSP() {
  const { data: session } = useSession()
  const shouldFetch = !!session
  const {
    data: playlists,
    error: playlistError,
    isLoading: playlistLoading,
  } = useSWR<RandomPlaylistApiResponse>(shouldFetch ? '/api/v2/random-playlist' : null, fetcher)
  const router = useRouter()

  const goToRandomPlaylist = () => {
    const randomIndex = Math.floor(Math.random() * playlists?.length || 0)
    router.push(`${playlists?.[randomIndex]?.external_urls.spotify}`)
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center my-auto">
        <div className="bg-[#191414] rounded-lg shadow-lg p-8 w-full max-w-md">
          <div className="flex flex-col justify-center space-y-3">
            <button
              onClick={() => signIn()}
              className="w-full p-3 rounded-md text-gb-highlight hover:ring-2 hover:ring-gb-highlight"
              type="button"
            >
              Sign in via Spotify
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (session) {
    return (
      <div className="flex flex-col items-center justify-center my-auto">
        <div className="bg-[#191414] rounded-lg shadow-lg p-8 w-full max-w-md">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Image
                className="mr-4 rounded-full"
                alt={session?.session?.user?.name}
                src={session?.session?.user?.image}
                height={48}
                style={{
                  aspectRatio: '48/48',
                  objectFit: 'cover',
                }}
                width={48}
              />
              <div>
                <h2 className="text-2xl font-bold">{session?.session?.user?.name}</h2>
              </div>
            </div>
          </div>
          <div className="space-y-10 text-center">
            {playlistLoading && (
              <p className="mb-4 text-left text-gray-400">
                Fetching your playlists. Wait time may be a little longer if you have many
                playlists.
              </p>
            )}
            <div className="flex flex-col justify-center space-y-3">
              <button
                onClick={() => goToRandomPlaylist()}
                disabled={!playlists?.length && playlistLoading}
                type='button'
                className={clsx(
                  'w-full p-3 rounded-md h-14 bg-gb-pastel-green-2 text-gb-highlight',
                  playlists?.length && !playlistLoading
                    ? 'hover:ring-2 hover:ring-gb-highlight'
                    : ''
                )}
              >
                {playlistLoading ? <SpinningCircleLoaderThingy /> : 'Take me to random playlist'}
              </button>
              <button
                className="w-full p-3 rounded-md h-14 hover:ring-2 hover:ring-gb-highlight"
                type='button'
                onClick={() => signOut()}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
