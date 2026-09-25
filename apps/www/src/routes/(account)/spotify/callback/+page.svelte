<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import * as Effect from 'effect/Effect'
  import {
    clearAuthorizationCallback,
    exchangeSpotifyPkceCodeEffect,
    notifySpotifySessionChanged,
    readAuthorizationCallback,
    spotifyErrorMessage,
    takeSpotifyReturnPath,
    type SpotifyRequestError,
  } from '@/lib/spotify-pkce'
  import { runAppEffect } from '@/runtime'

  let error = $state('')

  $effect(() => {
    void (async () => {
      const url = new URL(page.url.href)
      const callback = readAuthorizationCallback(url)
      const destination = takeSpotifyReturnPath()

      if (callback.error) {
        clearAuthorizationCallback(url)
        error = callback.error

        return
      }

      if (!callback.code) {
        error = 'Missing authorization code.'

        return
      }

      await runAppEffect(
        exchangeSpotifyPkceCodeEffect(callback.code).pipe(
          Effect.tap(() => Effect.sync(notifySpotifySessionChanged)),
          Effect.catch((cause: SpotifyRequestError) =>
            Effect.sync(() => {
              error = spotifyErrorMessage(cause)
            }),
          ),
        ),
      )

      if (!error) await goto(destination, { replaceState: true })
    })()
  })
</script>

<svelte:head><title>Spotify connection</title></svelte:head>
<section class="mx-auto max-w-xl px-4 py-20 text-center">
  {#if error}<h1 class="text-2xl font-black text-destructive">Spotify connection failed</h1>
    <p class="mt-4">{error}</p>
    <a class="mt-6 inline-block" href="/dashboard/player">Back to Player Settings</a>{:else}<p>
      Connecting Spotify…
    </p>{/if}
</section>
