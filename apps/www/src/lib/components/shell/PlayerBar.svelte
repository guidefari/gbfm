<script lang="ts">
  import { onMount } from 'svelte'
  import {
    PersistentPlayer,
    parsePlayerPreferencesEvent,
    parsePlayTrackEvent,
    type PlayerSnapshot
  } from '@/lib/player/player'

  let player: PersistentPlayer | undefined
  let snapshot = $state<PlayerSnapshot | null>(null)
  let queueOpen = $state(false)
  let draggedIndex = $state<number | null>(null)
  const current = $derived(
    snapshot ? (snapshot.queue.tracks[snapshot.queue.currentIndex] ?? null) : null
  )

  const telemetry = (name: string) => {
    const body = JSON.stringify({ kind: 'player', name, route: location.pathname })
    navigator.sendBeacon('/telemetry/browser', body)
  }

  onMount(() => {
    player = new PersistentPlayer(new Audio())
    const unsubscribe = player.subscribe((next) => (snapshot = next))
    const playTrack = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const track = parsePlayTrackEvent(event.detail)
      if (!track) return
      player?.playTrack(track)
      telemetry('play')
    }
    const preferencesChanged = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const preferences = parsePlayerPreferencesEvent(event.detail)
      if (preferences) player?.setPreferences(preferences)
    }
    const hotkeys = (event: KeyboardEvent) => {
      if (!player || !current) return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return
      const key = event.key.toLowerCase()
      if (event.code === 'Space') { event.preventDefault(); player.toggle() }
      else if (event.altKey && event.key === 'ArrowLeft') player.previous()
      else if (event.altKey && event.key === 'ArrowRight') player.next()
      else if (event.shiftKey && event.key === 'ArrowLeft') player.jump(-10)
      else if (event.shiftKey && event.key === 'ArrowRight') player.jump(10)
      else if (event.altKey && event.key === 'ArrowUp') player.setVolume(snapshot ? snapshot.volume + 10 : 100)
      else if (event.altKey && event.key === 'ArrowDown') player.setVolume(snapshot ? snapshot.volume - 10 : 0)
      else if (key === 'm') player.toggleMute()
      else if (key === 'q') queueOpen = !queueOpen
      else if (event.key === 'Escape') queueOpen = false
    }
    window.addEventListener('gbfm:play-track', playTrack)
    window.addEventListener('gbfm:player-preferences', preferencesChanged)
    window.addEventListener('keydown', hotkeys)
    return () => {
      unsubscribe()
      player?.destroy()
      window.removeEventListener('gbfm:play-track', playTrack)
      window.removeEventListener('gbfm:player-preferences', preferencesChanged)
      window.removeEventListener('keydown', hotkeys)
    }
  })

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '0:00'
    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
  }
</script>

{#if current && snapshot}
  <section aria-label="Audio player" class="fixed inset-x-0 bottom-12 z-30 border-t-2 border-foreground bg-background px-3 py-2 shadow-2xl">
    <div class="mx-auto flex max-w-6xl items-center gap-2 sm:gap-3">
      {#if current.thumbnailUrl}<img src={current.thumbnailUrl} alt="" class="h-10 w-10 shrink-0 object-cover" />{/if}
      <div class="min-w-0 flex-1">
        <strong class="block truncate text-sm">{current.title}</strong>
        <div class="flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
          <span>{formatTime(snapshot.currentTime)}</span>
          <input aria-label="Playback position" class="h-1 min-w-16 flex-1 accent-[var(--highlight)]" type="range" min="0" max={snapshot.duration || 0} step="0.1" value={snapshot.currentTime} oninput={(event) => player?.seek(Number(event.currentTarget.value))} />
          <span>{formatTime(snapshot.duration)}</span>
        </div>
      </div>
      <button aria-label="Previous track" title="Previous (Alt+Left)" class="px-1 font-bold" onclick={() => player?.previous()}>⏮</button>
      <button class="border-2 border-foreground px-3 py-1 text-xs font-bold" onclick={() => player?.toggle()}>{snapshot.playing ? 'Pause' : 'Play'}</button>
      <button aria-label="Next track" title="Next (Alt+Right)" class="px-1 font-bold" onclick={() => player?.next()}>⏭</button>
      <button aria-label={snapshot.muted ? 'Unmute' : 'Mute'} class="hidden px-1 sm:block" onclick={() => player?.toggleMute()}>{snapshot.muted ? '🔇' : '🔊'}</button>
      <input aria-label="Volume" title={`Volume ${snapshot.volume}%`} class="hidden w-20 accent-[var(--highlight)] sm:block" type="range" min="0" max="100" value={snapshot.muted ? 0 : snapshot.volume} oninput={(event) => player?.setVolume(Number(event.currentTarget.value))} />
      <button class="border border-foreground px-2 py-1 text-xs font-bold" aria-expanded={queueOpen} onclick={() => (queueOpen = !queueOpen)}>Queue ({snapshot.queue.tracks.length})</button>
    </div>
  </section>

  {#if queueOpen}
    <aside aria-label="Playback queue" class="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l-2 border-foreground bg-background shadow-2xl">
      <header class="flex items-center justify-between border-b border-border p-4">
        <div><h2 class="text-lg font-black">Queue</h2><p class="text-xs text-muted-foreground">Drag tracks or use the arrow buttons to reorder.</p></div>
        <button aria-label="Close queue" class="p-2 text-xl" onclick={() => (queueOpen = false)}>×</button>
      </header>
      <ol class="min-h-0 flex-1 overflow-y-auto p-2">
        {#each snapshot.queue.tracks as track, index (track.id)}
          <li
            draggable="true"
            ondragstart={() => (draggedIndex = index)}
            ondragover={(event) => event.preventDefault()}
            ondrop={() => { if (draggedIndex !== null) player?.reorder(draggedIndex, index); draggedIndex = null }}
            class={`mb-1 flex items-center gap-2 border p-2 ${index === snapshot.queue.currentIndex ? 'border-highlight bg-highlight/10' : 'border-border'}`}>
            <button class="min-w-0 flex-1 text-left" onclick={() => player?.playIndex(index)}>
              <span class="block truncate text-sm font-bold">{track.title}</span>
              <span class="text-xs text-muted-foreground">{index === snapshot.queue.currentIndex ? 'Now playing' : `Track ${index + 1}`}</span>
            </button>
            <button aria-label={`Move ${track.title} up`} disabled={index === 0} class="p-1 disabled:opacity-30" onclick={() => player?.reorder(index, index - 1)}>↑</button>
            <button aria-label={`Move ${track.title} down`} disabled={index === snapshot.queue.tracks.length - 1} class="p-1 disabled:opacity-30" onclick={() => player?.reorder(index, index + 1)}>↓</button>
            <button aria-label={`Remove ${track.title}`} class="p-1 text-destructive" onclick={() => player?.remove(index)}>×</button>
          </li>
        {/each}
      </ol>
      <footer class="border-t border-border p-4">
        <button class="w-full border-2 border-foreground px-3 py-2 text-sm font-bold" onclick={() => { player?.clear(); queueOpen = false }}>Clear queue</button>
      </footer>
    </aside>
  {/if}
{/if}
