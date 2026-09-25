<script lang="ts">
  import Artwork from './Artwork.svelte'
  import { records, text, type PublicRecord } from '@/lib/public-content'

  let { show, selected }: { show: PublicRecord; selected: boolean } = $props()

  const title = $derived(text(show.title, 'Untitled show'))

  const hosts = $derived(records(show.hosts).map((host) => text(host.name)).filter(Boolean).join(', '))
</script>

<a href={`/shows/${text(show.slug)}`} aria-current={selected ? 'page' : undefined} class={['flex w-full items-center gap-2 border-b border-border/40 px-1 py-1.5 no-underline transition-colors last:border-b-0', selected ? 'text-highlight' : 'text-foreground/70 hover:text-foreground']}>
  <span class="size-8 shrink-0"><Artwork {...(text(show.thumbnailUrl) ? { src: text(show.thumbnailUrl) } : {})} alt={title} /></span>
  <span class="min-w-0 flex-1">
    <span class="block truncate">{title}</span>
    {#if hosts}<span class="block truncate text-xs text-muted-foreground">{hosts}</span>{/if}
  </span>
</a>
