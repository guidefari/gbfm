<script lang="ts">
  import { enhance } from '$app/forms'
  import { ArrowLeft, ArrowRight, Shuffle } from 'lucide-svelte'

  let {
    newer,
    older,
    hasUnread,
  }: { newer: string | null; older: string | null; hasUnread: boolean } = $props()

  const step =
    'inline-flex h-full flex-1 items-center justify-center gap-1.5 text-sm no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'

  const live = `${step} text-foreground hover:bg-muted hover:text-highlight`

  const dead = `${step} cursor-not-allowed text-muted-foreground/40`
</script>

<nav aria-label="Tweet navigation" class="flex items-center gap-2">
  <div
    class="flex h-9 flex-1 divide-x divide-border overflow-hidden rounded-sm border border-border"
  >
    {#if newer}
      <a href={newer} class={live} aria-keyshortcuts="ArrowLeft"><ArrowLeft size={14} /> Newer</a>
    {:else}
      <span class={dead} aria-disabled="true"><ArrowLeft size={14} /> Newer</span>
    {/if}
    {#if older}
      <a href={older} class={live} aria-keyshortcuts="ArrowRight">Older <ArrowRight size={14} /></a>
    {:else}
      <span class={dead} aria-disabled="true">Older <ArrowRight size={14} /></span>
    {/if}
  </div>
  <form method="POST" action="?/random" use:enhance>
    <button
      disabled={!hasUnread}
      aria-label="Random unread tweet"
      title="Random unread tweet"
      class="grid size-9 place-items-center rounded-sm border border-border text-foreground transition-colors hover:bg-muted hover:text-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
    >
      <Shuffle size={14} />
    </button>
  </form>
</nav>
