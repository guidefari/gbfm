<script lang="ts">
  import Artwork from './Artwork.svelte'
  import { text, type PublicRecord } from '@/lib/public-content'

  let {
    items,
    href,
    empty = 'Nothing here yet.'
  }: { items: ReadonlyArray<PublicRecord>; href: (item: PublicRecord) => string; empty?: string } = $props()
  const value = (item: PublicRecord, ...keys: string[]) => {
    for (const key of keys) {
      const candidate = text(item[key])
      if (candidate) return candidate
    }
    return ''
  }
</script>

{#if items.length === 0}
  <p class="py-12 text-center text-muted-foreground">{empty}</p>
{:else}
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {#each items as item}
      <a href={href(item)} class="group border border-border bg-card p-3 no-underline transition-colors hover:border-highlight">
        <Artwork src={value(item, 'thumbnailUrl', 'imageUrl', 'image')} alt={value(item, 'title', 'name', 'slug') || 'Artwork'} />
        <h2 class="mb-1 mt-3 text-base font-bold group-hover:text-highlight">{value(item, 'title', 'name') || 'Untitled'}</h2>
        {#if value(item, 'description', 'bio')}
          <p class="line-clamp-3 text-sm text-muted-foreground">{value(item, 'description', 'bio')}</p>
        {/if}
      </a>
    {/each}
  </div>
{/if}
