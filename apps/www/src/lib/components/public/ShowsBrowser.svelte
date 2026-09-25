<script lang="ts">
  import EpisodeList from './EpisodeList.svelte'
  import PublicHead from './PublicHead.svelte'
  import PublicState from './PublicState.svelte'
  import ShowListItem from './ShowListItem.svelte'
  import ShowMeta from './ShowMeta.svelte'
  import ShowSwitcherRail from './ShowSwitcherRail.svelte'
  import { text, type PublicRecord } from '@/lib/public-content'

  let { shows, selected, episodes = [], failure = null, actionActive = false }: { shows: ReadonlyArray<PublicRecord>; selected: PublicRecord | null; episodes?: ReadonlyArray<PublicRecord>; failure?: string | null; actionActive?: boolean } = $props()

  const selectedId = $derived(text(selected?.id))

  const heading = 'mb-2 border-b border-border/60 pb-2 text-xs font-semibold tracking-wider text-muted-foreground'
</script>

<PublicHead title={selected ? text(selected.title, 'Radio Shows') : 'Radio Shows'} description={selected ? text(selected.description, 'Listen to radio shows on goosebumps.fm.') : 'Regular radio shows, hosts and episodes on goosebumps.fm.'} canonical={selected ? `/shows/${text(selected.slug)}` : '/shows'} {...(selected && text(selected.thumbnailUrl) ? { image: text(selected.thumbnailUrl) } : {})} />
{#if failure}
  <PublicState message={failure} error />
{:else if shows.length === 0 && !selected}
  <PublicState message="No shows found" />
{:else}
  <div class="grid w-full grid-cols-1 gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
    <aside class="hidden lg:block">
      <div class="no-scrollbar sticky top-4 max-h-[calc(100dvh-8rem)] overflow-y-auto">
        <h2 class={heading}>Radio shows</h2>
        <nav aria-label="Shows" class="font-mono text-base">
          {#each shows as show (text(show.id))}
            <ShowListItem {show} selected={text(show.id) === selectedId} />
          {/each}
        </nav>
      </div>
    </aside>

    <div class="lg:hidden"><ShowSwitcherRail {shows} {selectedId} /></div>

    <main class="min-w-0 max-w-4xl space-y-8">
      {#if selected}
        <ShowMeta show={selected} {actionActive} />
        <section>
          <h2 class={heading}>Episodes</h2>
          <EpisodeList {episodes} />
        </section>
      {:else}
        <PublicState message="Select a show to browse its mixes" />
      {/if}
    </main>
  </div>
{/if}
