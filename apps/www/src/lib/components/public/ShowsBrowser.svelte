<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { GetUserSubscriptionsResponse } from '@gbfm/api/user'
  import { Option, Predicate, Schema } from 'effect'
  import PublicHead from './PublicHead.svelte'
  import PublicState from './PublicState.svelte'
  import ShowEpisodes from './ShowEpisodes.svelte'
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

  let clientActionActive = $state<boolean | Promise<boolean>>(false)

  let clientNavigated = $state(false)

  const serverSlug = $derived(text(selected?.slug))

  const routeSlug = $derived.by(() => {
    const url = page.shallow?.url ?? page.url

    return url.pathname.startsWith('/shows/')
      ? decodeURIComponent(url.pathname.slice('/shows/'.length))
      : (url.searchParams.get('show') ?? text(shows[0]?.slug))
  })

  const displaySlug = $derived(text(previewShow?.slug) || routeSlug)

  const currentShow = $derived(
    previewShow ??
      shows.find((show) => text(show.slug) === displaySlug) ??
      (serverSlug === displaySlug ? selected : null),
  )

  const shownActionActive = $derived(
    !clientNavigated && routeSlug === serverSlug ? actionActive : clientActionActive,
  )

  const selectedId = $derived(text(currentShow?.id))

  $effect(() => {
    const slug = routeSlug
    const show = shows.find((item) => text(item.slug) === slug)

    if (!clientNavigated || !show || Predicate.isTagged(page.data.principal, 'Anonymous')) {
      clientActionActive = false

      return
    }

    clientActionActive = (async () => {
      try {
        const response = await fetch('/api/user/subscriptions?limit=100&offset=0')

        if (!response.ok) return false
        const body: unknown = await response.json()

        const subscriptions = Option.getOrNull(
          Schema.decodeUnknownOption(GetUserSubscriptionsResponse)(body),
        )

        return (
          subscriptions?.data.some((subscription) => subscription.showId === text(show.id)) ?? false
        )
      } catch {
        return false
      }
    })()
  })

  const preview = (show: PublicRecord, event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return

    event.preventDefault()
    const slug = text(show.slug)

    if (slug === routeSlug) return

    previewShow = show
    clientNavigated = true
    const href = `/shows/${encodeURIComponent(slug)}`
    void goto(href, { shallow: true, reset: false })
      .then(() => {
        previewShow = null
      })
      .catch(() => {
        window.location.assign(href)
      })
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
    class="grid w-full grid-cols-1 gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[220px_minmax(0,1fr)_240px] lg:gap-10"
  >
    <div class="lg:hidden"><ShowSwitcherRail {shows} {selectedId} onSelect={preview} /></div>

    {#if currentShow}
      <aside>
        <div
          class="no-scrollbar lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto"
        >
          <h2 class={[heading, 'hidden lg:block']}>Show</h2>
          {#key selectedId}
            <ShowMeta
              show={currentShow}
              actionActive={shownActionActive}
              showActions={previewShow === null}
            />
          {/key}
        </div>
      </aside>
    {/if}

    <main class="min-w-0 lg:col-start-2">
      {#if currentShow}
        <h2 class={heading}>Episodes</h2>
        <ShowEpisodes slug={displaySlug} {serverSlug} {episodes} />
      {:else}
        <PublicState message="Select a show to browse its mixes" />
      {/if}
    </main>

    <aside class="hidden lg:col-start-3 lg:block">
      <div class="no-scrollbar sticky top-4 max-h-[calc(100dvh-8rem)] overflow-y-auto pl-1">
        <h2 class={heading}>All shows</h2>
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
  </div>
{/if}
