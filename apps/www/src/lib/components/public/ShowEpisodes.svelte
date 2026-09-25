<script lang="ts">
  import { browser } from '$app/env'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { records, type PublicRecord } from '@/lib/public-content'
  import EpisodeList from './EpisodeList.svelte'
  import PublicState from './PublicState.svelte'

  let {
    slug,
    serverSlug,
    episodes,
  }: {
    slug: string
    serverSlug: string
    episodes: ReadonlyArray<PublicRecord> | Promise<ReadonlyArray<PublicRecord>>
  } = $props()

  const queryClient = useQueryClient()

  let primed = $state(false)

  $effect(() => {
    const initialEpisodes = episodes
    const initialSlug = serverSlug
    primed = false
    let current = true

    if (initialSlug)
      void Promise.resolve(initialEpisodes).then((data) => {
        if (!current) return
        queryClient.setQueryData(['show-episodes', initialSlug], data)
        primed = true
      })

    return () => {
      current = false
    }
  })

  const query = createQuery(() => ({
    queryKey: ['show-episodes', slug],
    queryFn: async () => {
      const response = await fetch(`/api/shows/${encodeURIComponent(slug)}/episodes`)

      if (!response.ok) throw new Error('Episodes unavailable')
      const body: unknown = await response.json()

      return records(body)
    },
    enabled: browser && Boolean(slug) && (slug !== serverSlug || primed),
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  }))
</script>

{#if slug === serverSlug && !primed}
  {#await episodes}
    <p class="py-6 text-sm text-muted-foreground" role="status">Loading episodes…</p>
  {:then loadedEpisodes}
    <EpisodeList episodes={loadedEpisodes} />
  {/await}
{:else if query.data !== undefined}
  <EpisodeList episodes={query.data} />
  {#if query.isError}
    <p class="pt-2 text-xs text-muted-foreground" role="status">Could not refresh episodes.</p>
  {/if}
{:else if query.isError}
  <PublicState message="Episodes are unavailable right now." error />
{:else}
  <p class="py-6 text-sm text-muted-foreground" role="status">Loading episodes…</p>
{/if}
