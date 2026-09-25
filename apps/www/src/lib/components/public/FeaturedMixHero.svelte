<script lang="ts">
  import Artwork from './Artwork.svelte'
  import { getPlayerContext } from '@/lib/player/context'
  import { records, text, type PublicRecord } from '@/lib/public-content'

  let { mix }: { mix: PublicRecord | undefined } = $props()
  const player = getPlayerContext()
  let error = $state('')
  const title = $derived(text(mix?.title, 'Featured mix'))
  const creators = $derived(records(mix?.creators).map((creator) => text(creator.name)).filter(Boolean).join(', '))
  const play = () => {
    const url = text(mix?.url)
    if (!url) { error = 'No audio available for this mix'; return }
    error = ''
    player.play({
      id: text(mix?.id, url), slug: text(mix?.slug), type: 'mix', url, title,
      thumbnailUrl: text(mix?.thumbnailUrl) || null
    })
  }
</script>

<div class="flex w-full flex-col gap-3">
  <div class="relative aspect-square w-full overflow-hidden border-2 border-foreground bg-muted">
    {#if mix}<Artwork src={text(mix.thumbnailUrl) || undefined} alt={title} />{:else}<div class="h-full animate-pulse bg-muted"></div>{/if}
    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent"></div>
    <div class="absolute inset-0 flex flex-col justify-between p-3">
      <span class="self-start bg-highlight px-2 py-1 text-[10px] font-bold uppercase tracking-[.25em] text-highlight-foreground">Featured</span>
      <div class="flex flex-col gap-3">
        <div>{#if mix}<a href={`/mixes/${text(mix.slug, text(mix.id))}`} class="text-2xl font-black leading-none text-white decoration-highlight hover:underline">{title}</a>{#if creators}<p class="mt-1 text-xs font-bold tracking-widest text-white/70">{creators}</p>{/if}{:else}<p class="font-bold text-white/70">No featured mix available</p>{/if}</div>
        <button disabled={!mix} onclick={play} class="w-full bg-highlight px-5 py-3 font-bold tracking-widest text-highlight-foreground disabled:opacity-50">▶ Play mix</button>
      </div>
    </div>
  </div>
  <a href="/shows" class="border-2 border-foreground px-5 py-3 text-center text-xs font-bold tracking-widest no-underline hover:bg-foreground hover:text-background">◉ Browse radio shows</a>
  {#if error}<p role="alert" class="text-xs font-bold text-destructive">{error}</p>{/if}
</div>
