<script lang="ts">
  import EpisodeList from './EpisodeList.svelte'
  import PublicHead from './PublicHead.svelte'
  import PublicState from './PublicState.svelte'
  import ShowListItem from './ShowListItem.svelte'
  import ShowMeta from './ShowMeta.svelte'
  import ShowSwitcherRail from './ShowSwitcherRail.svelte'
  import { text, type PublicRecord } from '@/lib/public-content'

  let {
    shows,
    selected,
    episodes = [],
    failure = null,
    actionActive = false,
  }: {
    shows: ReadonlyArray<PublicRecord>
    selected: PublicRecord | null
    episodes?: ReadonlyArray<PublicRecord> | Promise<ReadonlyArray<PublicRecord>>
    failure?: string | null
    actionActive?: boolean | Promise<boolean>
  } = $props()

  let previewShow = $state<PublicRecord | null>(null)

  $effect(() => {
    void selected
    previewShow = null
  })

  const currentShow = $derived(previewShow ?? selected)

  const selectedId = $derived(text(currentShow?.id))

  const preview = (show: PublicRecord, event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return

    if (text(show.id) !== text(selected?.id)) previewShow = show
  }

  const heading =
    'mb-2 border-b border-border/60 pb-2 text-xs font-semibold tracking-wider text-muted-foreground'
</script>

<PublicHead
  title={currentShow ? text(currentShow.title, 'Radio Shows') : 'Radio Shows'}
  description={currentShow
    ? text(currentShow.description, 'Listen to radio shows on goosebumps.fm.')
    : 'Regular radio shows, hosts and episodes on goosebumps.fm.'}
  canonical={currentShow ? `/shows/${text(currentShow.slug)}` : '/shows'}
  {...currentShow && text(currentShow.thumbnailUrl)
    ? { image: text(currentShow.thumbnailUrl) }
    : {}}
/>
{#if failure}
  <PublicState message={failure} error />
{:else if shows.length === 0 && !selected}
  <PublicState message="No shows found" />
{:else}
  <div
    class="grid w-full grid-cols-1 gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10"
  >
    <aside class="hidden lg:block">
      <div class="no-scrollbar sticky top-4 max-h-[calc(100dvh-8rem)] overflow-y-auto">
        <h2 class={heading}>Radio shows</h2>
        <nav aria-label="Shows" class="font-mono text-base">
          {#each shows as show (text(show.id))}
            <ShowListItem
              {show}
              selected={text(show.id) === selectedId}
              onSelect={(event) => preview(show, event)}
            />
          {/each}
        </nav>
      </div>
    </aside>

    <div class="lg:hidden"><ShowSwitcherRail {shows} {selectedId} onSelect={preview} /></div>

    <main class="min-w-0 max-w-4xl space-y-8">
      {#if currentShow}
        <ShowMeta show={currentShow} {actionActive} showActions={previewShow === null} />
        <section>
          <h2 class={heading}>Episodes</h2>
          {#if previewShow}
            <p class="py-6 text-sm text-muted-foreground" role="status">Loading episodes…</p>
          {:else}
            {#await episodes}
              <p class="py-6 text-sm text-muted-foreground" role="status">Loading episodes…</p>
            {:then loadedEpisodes}
              <EpisodeList episodes={loadedEpisodes} />
            {/await}
          {/if}
        </section>
      {:else}
        <PublicState message="Select a show to browse its mixes" />
      {/if}
    </main>
  </div>
{/if}
