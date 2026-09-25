<script lang="ts">
  import * as Effect from 'effect/Effect'
  import { onMount } from 'svelte'
  import { fetchSpotifyProfileEffect, getSpotifyRedirectUri, getValidSpotifyAuthSessionEffect, logoutSpotifyEffect, SPOTIFY_WEB_SCOPES, spotifyErrorMessage, startSpotifyPkceLoginEffect, storeSpotifyReturnPath, type SpotifyAuthSession, type SpotifyProfile, type SpotifyRequestError } from '@/lib/spotify-pkce'
  import { runAppEffect } from '@/runtime'

  let session = $state<SpotifyAuthSession | undefined>()
  let profile = $state<SpotifyProfile | undefined>()
  let pending = $state(true)
  let connecting = $state(false)
  let error = $state('')
  const expiresIn = $derived.by(() => { if (!session) return ''; const minutes = Math.max(0, Math.floor((session.accessTokenExpiresAt - Date.now()) / 60_000)); return minutes < 60 ? `~${minutes}m` : `~${Math.floor(minutes / 60)}h ${minutes % 60}m` })

  async function refresh() {
    pending = true; error = ''
    session = await runAppEffect(getValidSpotifyAuthSessionEffect().pipe(Effect.catch((cause: SpotifyRequestError) => Effect.sync(() => { error = spotifyErrorMessage(cause); return undefined }))))
    profile = session ? await runAppEffect(fetchSpotifyProfileEffect().pipe(Effect.catch((cause: SpotifyRequestError) => Effect.sync(() => { error = spotifyErrorMessage(cause); return undefined })))) : undefined
    pending = false
  }
  async function connect() {
    connecting = true; error = ''; storeSpotifyReturnPath(`${location.pathname}${location.search}`)
    const url = await runAppEffect(startSpotifyPkceLoginEffect(SPOTIFY_WEB_SCOPES, getSpotifyRedirectUri()).pipe(Effect.catch((cause: SpotifyRequestError) => Effect.sync(() => { error = spotifyErrorMessage(cause); return null }))))
    if (url) location.assign(url); else connecting = false
  }
  async function disconnect() { await runAppEffect(logoutSpotifyEffect().pipe(Effect.orDie)); session = undefined; profile = undefined }
  onMount(refresh)
</script>

<div class="space-y-8">
  <div class="space-y-1"><h2 class="flex items-center gap-2 text-base font-bold tracking-widest text-muted-foreground"><span class="text-[#1db954]" aria-hidden="true">●</span> Spotify Connection</h2><p class="text-xs font-medium tracking-wider text-muted-foreground">Connect Spotify to play and queue tracks straight from music cards.</p><p class="text-xs font-medium tracking-wider text-muted-foreground/70">Redirect URI: <code>{getSpotifyRedirectUri()}</code></p></div>
  {#if pending}<p class="text-xs font-medium tracking-wider text-muted-foreground">Checking session…</p>{:else if session}<div class="w-full max-w-md space-y-4"><div class="flex items-center justify-between gap-6 border-2 border-border p-6"><div class="min-w-0 space-y-2"><strong class="block truncate text-base tracking-widest">{profile?.display_name ?? profile?.id ?? 'Connected'}</strong><span class="text-xs text-muted-foreground">Token expires {expiresIn}</span></div><span class="text-xs font-bold tracking-widest text-green-500">Connected</span></div><div class="flex gap-2"><button class="border border-border px-3 py-1.5 text-sm" onclick={() => void refresh()}>Refresh session</button><button class="px-3 py-1.5 text-sm" onclick={() => void disconnect()}>Disconnect</button></div></div>{:else}<button class="w-full max-w-md bg-foreground px-4 py-2 font-bold text-background disabled:opacity-50" disabled={connecting} onclick={() => void connect()}>{connecting ? 'Connecting…' : 'Connect Spotify'}</button>{/if}
  {#if error}<p class="text-xs text-destructive" role="alert">{error}</p>{/if}
</div>
