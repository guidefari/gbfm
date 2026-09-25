<script lang="ts">
  import type { MicroPostNeighboursResponse } from '@gbfm/api/navigation'

  let { neighbours }: { neighbours: MicroPostNeighboursResponse | null } = $props()

  const current = $derived(neighbours ? Math.min(neighbours.position + 1, neighbours.total) : 0)

  const percent = $derived(
    neighbours && neighbours.total > 1 ? (neighbours.position / (neighbours.total - 1)) * 100 : 0,
  )
</script>

<div class="mb-6 space-y-1.5" aria-busy={!neighbours}>
  <div
    role="meter"
    aria-label="Position in tweets, newest first"
    aria-valuemin={1}
    aria-valuemax={neighbours?.total ?? 1}
    aria-valuenow={current || 1}
    class="relative h-1 bg-border/40"
  >
    {#if neighbours}
      <div class="absolute inset-y-0 left-0 bg-muted-foreground/40" style:width="{percent}%"></div>
      <div
        class="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-foreground"
        style:left="{percent}%"
      ></div>
    {/if}
  </div>
  <p class="flex justify-between font-mono text-xs text-muted-foreground">
    {#if neighbours}
      <span>{current} of {neighbours.total}</span>
      <span>{neighbours.unreadCount} unread</span>
    {:else}
      <span>&nbsp;</span>
    {/if}
  </p>
</div>
