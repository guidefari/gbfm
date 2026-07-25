import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as Effect from 'effect/Effect'
import { useEffect, useState } from 'react'
import {
  clearAuthorizationCallback,
  exchangeSpotifyPkceCodeEffect,
  notifySpotifySessionChanged,
  readAuthorizationCallback,
  type SpotifyRequestError,
  spotifyErrorMessage,
  takeSpotifyReturnPath
} from '@/lib/spotify-pkce'
import { runAppEffect } from '@/runtime'

export const Route = createFileRoute('/spotify/callback')({
  component: SpotifyCallback
})

function SpotifyCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const callback = readAuthorizationCallback(url)
    const returnPath = takeSpotifyReturnPath()

    if (callback.error) {
      clearAuthorizationCallback(url)
      setError(callback.error)
      return
    }

    if (!callback.code) {
      setError('Missing authorization code.')
      return
    }

    void runAppEffect(
      exchangeSpotifyPkceCodeEffect(callback.code).pipe(
        Effect.map(() => {
          notifySpotifySessionChanged()
          void navigate({ to: returnPath, replace: true })
        }),
        Effect.catch((e: SpotifyRequestError) =>
          Effect.sync(() => setError(spotifyErrorMessage(e)))
        )
      )
    )
  }, [navigate])

  return (
    <div className='flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center'>
      {error ? (
        <>
          <h1 className='text-sm font-bold tracking-widest text-destructive'>
            Spotify connection failed
          </h1>
          <p className='max-w-md text-xs font-medium tracking-wider text-muted-foreground'>
            {error}
          </p>
          <button
            type='button'
            onClick={() => void navigate({ to: '/dashboard/player', replace: true })}
            className='mt-2 text-xs font-bold tracking-widest underline underline-offset-4'>
            Back to Player Settings
          </button>
        </>
      ) : (
        <p className='text-sm font-medium tracking-wider text-muted-foreground'>
          Connecting Spotify…
        </p>
      )}
    </div>
  )
}
