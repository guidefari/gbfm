<script lang="ts">
  import type { Snippet } from 'svelte'

  let { title, description, children }: { title: string; description?: string; children: Snippet } =
    $props()
</script>

<svelte:head
  ><title>{title} | goosebumps.fm</title><meta name="robots" content="noindex" /></svelte:head
>
<header class="mb-8">
  <h1 class="text-3xl font-black tracking-tight">{title}</h1>
  {#if description}<p class="mt-2 text-muted-foreground">{description}</p>{/if}
</header>
<div class="space-y-6">{@render children()}</div>
