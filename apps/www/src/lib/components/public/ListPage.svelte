<script lang="ts">
  import ContentGrid from './ContentGrid.svelte'
  import PublicHead from './PublicHead.svelte'
  import PublicState from './PublicState.svelte'
  import type { PublicRecord } from '@/lib/server/public/content'

  let {
    data,
    title,
    description,
    canonical,
    href,
    intro,
    empty,
  }: {
    data: { items: ReadonlyArray<PublicRecord>; failure: string | null }
    title: string
    description: string
    canonical: string
    href: (item: PublicRecord) => string
    intro?: string
    empty?: string
  } = $props()
</script>

<PublicHead {title} {description} {canonical} />
<section class="mx-auto max-w-7xl px-4 py-8">
  <h1 class="mb-2 text-3xl font-black tracking-tight">{title}</h1>
  {#if intro}<p class="mb-8 text-muted-foreground">{intro}</p>{/if}
  {#if data.failure}
    <PublicState message={data.failure} error />
  {:else}
    <ContentGrid items={data.items} {href} {...empty === undefined ? {} : { empty }} />
  {/if}
</section>
