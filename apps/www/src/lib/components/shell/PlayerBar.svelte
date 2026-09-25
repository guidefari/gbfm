<script lang="ts">
  import { onMount } from 'svelte'
  import { PersistentPlayer, parsePlayerPreferencesEvent, parsePlayTrackEvent, type PlayerSnapshot } from '@/lib/player/player'

  let player: PersistentPlayer | undefined
  let snapshot = $state<PlayerSnapshot | null>(null)
  let fullscreen = $state(false)
  let queueOpen = $state(false)
  let draggedIndex = $state<number | null>(null)
  const current = $derived(snapshot ? (snapshot.queue.tracks[snapshot.queue.currentIndex] ?? null) : null)
  const progress = $derived(snapshot?.duration ? Math.min(100, (snapshot.currentTime / snapshot.duration) * 100) : 0)

  const formatTime = (seconds: number) => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}` : '0:00'
  const announceChrome = () => window.dispatchEvent(new CustomEvent('gbfm:player-chrome', { detail: current && snapshot ? { id: current.id, playing: snapshot.playing, title: current.title, thumbnailUrl: current.thumbnailUrl, progress } : null }))
  const telemetry = (name: string) => navigator.sendBeacon('/telemetry/browser', JSON.stringify({ kind: 'player', name, route: location.pathname }))

  onMount(() => {
    player = new PersistentPlayer(new Audio())
    const unsubscribe = player.subscribe((next) => { snapshot = next; queueMicrotask(announceChrome) })
    const playTrack = (event: Event) => { if (event instanceof CustomEvent) { const track = parsePlayTrackEvent(event.detail); if (track) { player?.playTrack(track); telemetry('play') } } }
    const enqueueTrack = (event: Event) => { if (event instanceof CustomEvent) { const track = parsePlayTrackEvent(event.detail); if (track) { player?.enqueue(track); telemetry('enqueue') } } }
    const preferencesChanged = (event: Event) => { if (event instanceof CustomEvent) { const preferences = parsePlayerPreferencesEvent(event.detail); if (preferences) player?.setPreferences(preferences) } }
    const toggleFullscreen = () => { if (current) fullscreen = !fullscreen }
    const togglePlayback = () => player?.toggle()
    const requestChrome = () => announceChrome()
    const hotkeys = (event: KeyboardEvent) => {
      const target = event.target
      if (!player || !current || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return
      const key = event.key.toLowerCase()
      if (event.code === 'Space') { event.preventDefault(); player.toggle() }
      else if (event.altKey && event.key === 'ArrowLeft') player.previous()
      else if (event.altKey && event.key === 'ArrowRight') player.next()
      else if (event.shiftKey && event.key === 'ArrowLeft') player.jump(-10)
      else if (event.shiftKey && event.key === 'ArrowRight') player.jump(10)
      else if (event.altKey && event.key === 'ArrowUp') player.setVolume((snapshot?.volume ?? 90) + 10)
      else if (event.altKey && event.key === 'ArrowDown') player.setVolume((snapshot?.volume ?? 10) - 10)
      else if (key === 'm') player.toggleMute()
      else if (key === 'q') queueOpen = !queueOpen
      else if (key === 'f') fullscreen = !fullscreen
      else if (event.key === 'Escape') { if (queueOpen) queueOpen = false; else fullscreen = false }
    }
    window.addEventListener('gbfm:play-track', playTrack)
    window.addEventListener('gbfm:enqueue-track', enqueueTrack)
    window.addEventListener('gbfm:player-preferences', preferencesChanged)
    window.addEventListener('gbfm:player-fullscreen', toggleFullscreen)
    window.addEventListener('gbfm:player-toggle', togglePlayback)
    window.addEventListener('gbfm:player-chrome-request', requestChrome)
    window.addEventListener('keydown', hotkeys)
    return () => { unsubscribe(); player?.destroy(); window.removeEventListener('gbfm:play-track', playTrack); window.removeEventListener('gbfm:enqueue-track', enqueueTrack); window.removeEventListener('gbfm:player-preferences', preferencesChanged); window.removeEventListener('gbfm:player-fullscreen', toggleFullscreen); window.removeEventListener('gbfm:player-toggle', togglePlayback); window.removeEventListener('gbfm:player-chrome-request', requestChrome); window.removeEventListener('keydown', hotkeys) }
  })
</script>

{#if fullscreen && current && snapshot}
  <section aria-label="Now playing" class="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background text-foreground">
    <header class="flex shrink-0 items-center justify-between px-4 py-3 sm:p-6"><button aria-label="Collapse player" title="Close (Escape)" class="grid size-10 place-items-center text-2xl text-muted-foreground hover:text-foreground" onclick={() => (fullscreen = false)}>⌄</button><button aria-label="Open queue" aria-expanded={queueOpen} class="border border-border px-3 py-2 text-xs font-bold" onclick={() => (queueOpen = true)}>Queue ({snapshot.queue.tracks.length})</button></header>
    <div class="flex min-h-0 flex-1 flex-col items-center overflow-hidden px-4 pb-6 sm:justify-center sm:px-8 sm:pb-8">
      <div class="flex min-h-0 w-full max-w-2xl flex-1 flex-col">
        <div class="mb-4 flex min-h-0 flex-1 items-center justify-center sm:mb-8">{#if current.thumbnailUrl}<img src={current.thumbnailUrl} alt={current.title} class="max-h-full max-w-full rounded-sm object-contain shadow-2xl" />{:else}<div class="grid aspect-square max-h-full w-full max-w-lg place-items-center bg-muted text-8xl text-muted-foreground">♪</div>{/if}</div>
        <div class="mb-4 shrink-0 sm:mb-8"><h1 class="truncate text-xl font-semibold sm:text-2xl">{current.title}</h1><p class="mt-1 truncate text-sm text-muted-foreground">{current.creators?.map((creator) => creator.name).join(', ') || 'Unknown creator'}</p></div>
        <div class="mb-4 shrink-0 sm:mb-8"><input aria-label="Playback position" class="h-2 w-full cursor-pointer accent-[var(--highlight)]" type="range" min="0" max={snapshot.duration || 0} step="0.1" value={snapshot.currentTime} oninput={(event) => player?.seek(Number(event.currentTarget.value))} /><div class="mt-2 flex justify-between text-sm tabular-nums text-muted-foreground"><span>{formatTime(snapshot.currentTime)}</span><span>-{formatTime(Math.max(0, snapshot.duration - snapshot.currentTime))}</span></div></div>
        <div class="mb-4 flex shrink-0 items-center justify-center gap-6 sm:mb-8"><button aria-label="Previous track" title="Previous (Alt+Left)" class="size-12 text-2xl" onclick={() => player?.previous()}>◀|</button><button aria-label={snapshot.playing ? 'Pause' : 'Play'} class="size-16 rounded-sm bg-highlight/20 text-2xl" onclick={() => player?.toggle()}>{snapshot.playing ? 'Ⅱ' : '▶'}</button><button aria-label="Next track" title="Next (Alt+Right)" class="size-12 text-2xl" onclick={() => player?.next()}>|▶</button></div>
        <div class="hidden shrink-0 items-center gap-4 sm:flex"><button aria-label={snapshot.muted ? 'Unmute' : 'Mute'} title="Mute (M)" class="size-9" onclick={() => player?.toggleMute()}>{snapshot.muted ? '🔇' : '🔊'}</button><input aria-label="Volume" class="h-2 flex-1 accent-[var(--highlight)]" type="range" min="0" max="100" value={snapshot.muted ? 0 : snapshot.volume} oninput={(event) => player?.setVolume(Number(event.currentTarget.value))} /><span class="w-10 text-right text-xs tabular-nums text-muted-foreground">{snapshot.volume}%</span></div>
      </div>
    </div>
  </section>
{/if}

{#if queueOpen && snapshot}
  <aside aria-label="Playback queue" class="fixed inset-y-0 right-0 z-[60] flex w-full max-w-sm flex-col border-l-2 border-foreground bg-background shadow-2xl">
    <header class="flex items-center justify-between border-b border-border p-4"><div><h2 class="text-lg font-black">Queue</h2><p class="text-xs text-muted-foreground">Choose or reorder what plays next.</p></div><button aria-label="Close queue" class="p-2 text-xl" onclick={() => (queueOpen = false)}>×</button></header>
    <ol class="min-h-0 flex-1 overflow-y-auto p-2">{#each snapshot.queue.tracks as track, index (track.id)}<li draggable="true" ondragstart={() => (draggedIndex = index)} ondragover={(event) => event.preventDefault()} ondrop={() => { if (draggedIndex !== null) player?.reorder(draggedIndex, index); draggedIndex = null }} class={`mb-1 flex items-center gap-2 border p-2 ${index === snapshot.queue.currentIndex ? 'border-highlight bg-highlight/10' : 'border-border'}`}>{#if track.thumbnailUrl}<img src={track.thumbnailUrl} alt="" class="size-11 shrink-0 object-cover" />{/if}<button class="min-w-0 flex-1 text-left" onclick={() => player?.playIndex(index)}><span class="block truncate text-sm font-bold">{track.title}</span><span class="text-xs text-muted-foreground">{index === snapshot.queue.currentIndex ? 'Now playing' : `Track ${index + 1}`}</span></button><button aria-label={`Move ${track.title} up`} disabled={index === 0} class="p-1 disabled:opacity-30" onclick={() => player?.reorder(index, index - 1)}>↑</button><button aria-label={`Move ${track.title} down`} disabled={index === snapshot.queue.tracks.length - 1} class="p-1 disabled:opacity-30" onclick={() => player?.reorder(index, index + 1)}>↓</button><button aria-label={`Remove ${track.title}`} class="p-1 text-destructive" onclick={() => player?.remove(index)}>×</button></li>{/each}</ol>
    <footer class="border-t border-border p-4"><button class="w-full border-2 border-foreground px-3 py-2 text-sm font-bold" onclick={() => { player?.clear(); queueOpen = false; fullscreen = false }}>Clear queue</button></footer>
  </aside>
{/if}
