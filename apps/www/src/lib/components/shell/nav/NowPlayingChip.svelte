<script lang="ts">
  import { Pause, Play } from 'lucide-svelte'
  import { getPlayerContext } from '@/lib/player/context'
  import type { NowPlaying } from './now-playing'

  let { player }: { player: NowPlaying } = $props()

  const controls = getPlayerContext()
</script>

<div class="flex min-w-0 max-w-64 items-center gap-2 border-r border-border pr-3">
  <button type="button" aria-label={player.playing ? 'Pause' : 'Play'} class="grid size-7 shrink-0 place-items-center rounded-sm border border-border transition-colors hover:bg-muted" onclick={controls.toggle}>
    {#if player.playing}<Pause size={14} fill="currentColor" />{:else}<Play size={14} fill="currentColor" />{/if}
  </button>
  <button type="button" title="Open player (F)" class="flex min-w-0 items-center gap-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground" onclick={() => controls.fullscreen.set(true)}>
    {#if player.thumbnailUrl}<img src={player.thumbnailUrl} alt="" class="size-6 shrink-0 rounded-sm object-cover" />{/if}
    <span class="truncate">{player.title}</span>
  </button>
</div>
