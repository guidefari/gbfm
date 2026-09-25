<script lang="ts">
  import { GetFavoritesResponse } from '@gbfm/api/favorites'
  import { Heart, Play } from 'lucide-svelte'
  import { DEFAULT_IMAGE_URL } from '@/lib/constants'

  let { favorites, error = null }: { favorites: typeof GetFavoritesResponse.Type.favorites; error?: string | null } = $props()
  const audioFavorites = $derived(favorites.filter((favorite) => favorite.audio !== null).slice(0, 6))
</script>

<section aria-labelledby="favorites-heading">
  <h2 id="favorites-heading" class="mb-6 flex items-center gap-2 text-xs font-bold tracking-widest">
    <Heart class="size-3.5 text-red-500" /> Favorites
  </h2>
  {#if error}
    <p class="rounded border border-destructive/50 p-4 text-sm text-destructive">{error}</p>
  {:else if audioFavorites.length === 0}
    <div class="rounded border border-dashed p-8 text-center"><Heart class="mx-auto mb-3 size-6 text-muted-foreground" /><p class="font-semibold">No favorites yet</p><a class="mt-2 inline-block text-sm underline" href="/mixes">Discover mixes</a></div>
  {:else}
    <div class="space-y-3">
      {#each audioFavorites as favorite}
        {@const audio = favorite.audio}
        {#if audio}
          <a class="group flex items-center gap-4 rounded p-2 no-underline transition-colors hover:bg-muted/40" href={audio.type === 'mix' ? `/mixes/${audio.slug}` : audio.type === 'track' ? `/tracks/${audio.slug}` : audio.url}>
            <span class="relative shrink-0"><img class="size-12 rounded border object-cover" src={audio.thumbnailUrl || DEFAULT_IMAGE_URL} alt="" /><span class="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100"><Play class="size-5 fill-white text-white" /></span></span>
            <span class="min-w-0"><strong class="block truncate">{audio.title}</strong><small class="mt-1 block font-bold uppercase tracking-widest text-muted-foreground">{audio.type}</small></span>
          </a>
        {/if}
      {/each}
    </div>
  {/if}
</section>
