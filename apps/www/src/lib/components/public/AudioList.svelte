<script lang="ts">
  import Artwork from './Artwork.svelte'
  import { getPlayerContext } from '@/lib/player/context'
  import { text, type PublicRecord } from '@/lib/public-content'
  let { items }: { items: ReadonlyArray<PublicRecord> } = $props()
  const player = getPlayerContext()
  const play = (item: PublicRecord) => player.play({ id: text(item.id, text(item.url)), slug: text(item.slug), type: 'mix', url: text(item.url), title: text(item.title, 'Episode'), thumbnailUrl: text(item.thumbnailUrl) || null })
</script>

{#if items.length === 0}<p class="text-muted-foreground">No episodes yet.</p>{:else}<ol class="divide-y divide-border border-y border-border">{#each items as item, index}<li class="flex items-center gap-4 py-3"><span class="w-8 text-center font-mono text-sm text-muted-foreground">{text(item.episodeNumber, String(index + 1))}</span><div class="h-14 w-14 shrink-0"><Artwork src={text(item.thumbnailUrl) || undefined} alt={text(item.title, 'Episode')} /></div><div class="min-w-0 flex-1"><a class="font-bold" href={`/mixes/${text(item.slug, text(item.id))}`}>{text(item.title, 'Untitled episode')}</a>{#if text(item.description)}<p class="line-clamp-1 text-sm text-muted-foreground">{text(item.description)}</p>{/if}</div>{#if text(item.url)}<button aria-label={`Play ${text(item.title, 'episode')}`} class="border border-border px-3 py-2 font-bold" onclick={() => play(item)}>▶</button>{/if}</li>{/each}</ol>{/if}
