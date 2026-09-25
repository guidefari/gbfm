<script lang="ts">
  import EpisodeRow from './EpisodeRow.svelte'
  import { getPlayerContext } from '@/lib/player/context'
  import { text, type PublicRecord } from '@/lib/public-content'

  let { episodes }: { episodes: ReadonlyArray<PublicRecord> } = $props()
  const player = getPlayerContext()
  const snapshot = player.snapshot
  const currentId = $derived($snapshot ? ($snapshot.queue.tracks[$snapshot.queue.currentIndex]?.id ?? '') : '')
  const trackId = (episode: PublicRecord) => text(episode.id, text(episode.url))

  const play = (episode: PublicRecord) => {
    if (trackId(episode) === currentId) player.toggle()
    else player.play({ id: trackId(episode), slug: text(episode.slug), type: 'mix', url: text(episode.url), title: text(episode.title, 'Episode'), thumbnailUrl: text(episode.thumbnailUrl) || null })
  }
</script>

{#if episodes.length === 0}
  <p class="py-8 text-center font-mono text-base text-muted-foreground">No episodes yet</p>
{:else}
  <div class="font-mono">
    {#each episodes as episode (trackId(episode))}
      <EpisodeRow {episode} active={trackId(episode) === currentId} playing={$snapshot?.playing ?? false} onPlay={() => play(episode)} />
    {/each}
  </div>
{/if}
