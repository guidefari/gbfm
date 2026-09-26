<script lang="ts">
  import { Pause, Play } from 'lucide-svelte'
  import { getPlayerContext } from '@/lib/player/context'
  import type { NowPlaying } from './now-playing'

  let { player }: { player: NowPlaying } = $props()

  const controls = getPlayerContext()
</script>

<div class="flex min-w-0 max-w-56 shrink items-center gap-2 border-r border-border pr-3">
  <button
    type="button"
    aria-label={player.playing ? 'Pause' : 'Play'}
    class="flex size-7 shrink-0 items-center justify-center rounded-sm border border-border text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    onclick={controls.toggle}
  >
    {#if player.playing}<Pause class="size-3.5" fill="currentColor" />{:else}<Play
        class="size-3.5"
        fill="currentColor"
      />{/if}
  </button>
  <button
    type="button"
    title="Open player (F)"
    class="min-w-0 flex-1 truncate text-left text-xs font-medium text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    onclick={() => controls.fullscreen.set(true)}
  >
    {player.title}
  </button>
</div>
