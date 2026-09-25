<script lang="ts">
  import * as Effect from 'effect/Effect'
  import { onMount } from 'svelte'
  import Page from '@/lib/components/dashboard/Page.svelte'
  import {
    fetchSpotifyProfileEffect,
    getSpotifyRedirectUri,
    getValidSpotifyAuthSessionEffect,
    logoutSpotifyEffect,
    SPOTIFY_WEB_SCOPES,
    spotifyErrorMessage,
    startSpotifyPkceLoginEffect,
    storeSpotifyReturnPath,
    type SpotifyAuthSession,
    type SpotifyProfile,
    type SpotifyRequestError
  } from '@/lib/spotify-pkce'
  import { runAppEffect } from '@/runtime'

  let session = $state<SpotifyAuthSession | undefined>()
  let profile = $state<SpotifyProfile | undefined>()
  let pending = $state(true)
  let error = $state('')

  const expiresIn = $derived.by(() => {
    if (!session) return ''
    const minutes = Math.max(0, Math.floor((session.accessTokenExpiresAt - Date.now()) / 60_000))
    return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  })

  async function refresh() {
    pending = true
    error = ''
    session = await runAppEffect(
      getValidSpotifyAuthSessionEffect().pipe(
        Effect.catch((cause: SpotifyRequestError) =>
          Effect.sync(() => { error = spotifyErrorMessage(cause); return undefined })
        )
      )
    )
    profile = session
      ? await runAppEffect(
          fetchSpotifyProfileEffect().pipe(
            Effect.catch((cause: SpotifyRequestError) =>
              Effect.sync(() => { error = spotifyErrorMessage(cause); return undefined })
            )
          )
        )
      : undefined
    pending = false
  }

  async function connect() {
    pending = true
    error = ''
    storeSpotifyReturnPath(`${location.pathname}${location.search}`)
    const url = await runAppEffect(
      startSpotifyPkceLoginEffect(SPOTIFY_WEB_SCOPES, getSpotifyRedirectUri()).pipe(
        Effect.catch((cause: SpotifyRequestError) =>
          Effect.sync(() => { error = spotifyErrorMessage(cause); return null })
        )
      )
    )
    if (url) location.assign(url)
    else pending = false
  }

  async function disconnect() {
    await runAppEffect(logoutSpotifyEffect().pipe(Effect.orDie))
    session = undefined
    profile = undefined
  }

  onMount(refresh)
</script>

<Page title="Integrations" description="Connect services used for music discovery and playback.">
  <section class="max-w-2xl rounded border p-5">
    <p class="text-xs font-bold uppercase tracking-widest text-[#1db954]">Spotify</p>
    <h2 class="mt-2 text-xl font-black">Spotify connection</h2>
    <p class="mt-2 text-sm text-muted-foreground">Connect Spotify to play, save, and queue tracks from music cards.</p>
    <p class="mt-2 break-all text-xs text-muted-foreground">Redirect URI: <code>{getSpotifyRedirectUri()}</code></p>
    {#if pending}<p class="mt-6">Checking connection…</p>
    {:else if session}
      <div class="mt-6 border-2 border-border p-5"><strong>{profile?.display_name ?? profile?.id ?? 'Connected'}</strong><span class="ml-3 text-sm font-bold text-[#1db954]">Connected</span><p class="mt-1 text-xs text-muted-foreground">Token expires in {expiresIn}</p></div>
      <div class="mt-4 flex gap-3"><button class="rounded border px-4 py-2" onclick={() => void refresh()}>Refresh session</button><button class="rounded border px-4 py-2" onclick={() => void disconnect()}>Disconnect</button></div>
    {:else}<button class="mt-6 rounded bg-[#1db954] px-5 py-3 font-bold text-black" onclick={() => void connect()}>Connect Spotify</button>{/if}
    {#if error}<p role="alert" class="mt-4 text-destructive">{error}</p>{/if}
  </section>
</Page>
