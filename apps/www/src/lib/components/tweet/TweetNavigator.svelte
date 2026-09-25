<script lang="ts">
  import { enhance } from '$app/forms'
  import { ArrowLeft, ArrowRight, Shuffle } from 'lucide-svelte'

  let {
    newer,
    older,
    hasUnread,
  }: { newer: string | null; older: string | null; hasUnread: boolean } = $props()

  const button =
    'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-sm border border-border px-3 text-sm no-underline transition-colors'

  const enabled = `${button} text-foreground hover:bg-muted`

  const disabled = `${button} cursor-not-allowed text-muted-foreground opacity-40`
</script>

<nav aria-label="Tweet navigation" class="flex items-center gap-2">
  {#if newer}
    <a href={newer} class="{enabled} flex-1" aria-keyshortcuts="ArrowLeft">
      <ArrowLeft size={14} /> Newer
    </a>
  {:else}
    <span class="{disabled} flex-1" aria-disabled="true"><ArrowLeft size={14} /> Newer</span>
  {/if}
  {#if older}
    <a href={older} class="{enabled} flex-1" aria-keyshortcuts="ArrowRight">
      Older <ArrowRight size={14} />
    </a>
  {:else}
    <span class="{disabled} flex-1" aria-disabled="true">Older <ArrowRight size={14} /></span>
  {/if}
  <form method="POST" action="?/random" use:enhance>
    <button
      class={hasUnread ? enabled : disabled}
      disabled={!hasUnread}
      aria-label="Random unread tweet"
      title="Random unread tweet"
    >
      <Shuffle size={14} />
    </button>
  </form>
</nav>
