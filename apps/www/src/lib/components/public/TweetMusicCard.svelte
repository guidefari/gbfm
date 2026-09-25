<script lang="ts">
  import { ExternalLink, Music4 } from 'lucide-svelte'
  import { text, type PublicRecord } from '@/lib/public-content'

  let {
    type,
    entity,
    links
  }: { type: string; entity: PublicRecord | null; links: ReadonlyArray<PublicRecord> } = $props()

  const musicLabel = $derived(
    type === 'album' ? 'Album' : type === 'track' ? 'Track' : type === 'playlist' ? 'Playlist' : 'Music'
  )
  const platformLabel = (platform: string) => {
    if (platform === 'spotify') return 'Spotify'
    if (platform === 'youtube') return 'YouTube'
    if (platform === 'youtube_music') return 'YT Music'
    if (platform === 'apple_music') return 'Apple Music'
    if (platform === 'bandcamp') return 'Bandcamp'
    if (platform === 'soundcloud') return 'SoundCloud'
    return platform || 'Link'
  }
</script>

{#if entity}
  <article class="not-prose min-w-0 overflow-hidden rounded-md border border-border/50 bg-muted/20">
    <div class="flex items-start gap-4 p-4 sm:gap-5">
      <div class="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted sm:size-32">
        {#if text(entity.coverImageUrl)}
          <img src={text(entity.coverImageUrl)} alt={text(entity.title)} class="size-full object-cover" />
        {:else}
          <Music4 class="size-10 text-muted-foreground/70" aria-hidden="true" />
        {/if}
      </div>
      <div class="min-w-0 flex-1 space-y-2">
        <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/70">{musicLabel}</p>
        <h2 class="break-words text-lg font-bold leading-snug tracking-tight text-foreground sm:text-xl">{text(entity.title)}</h2>
        {#if Array.isArray(entity.artistNames) && entity.artistNames.length}
          <p class="text-sm text-muted-foreground">{entity.artistNames.join(', ')}</p>
        {/if}
      </div>
    </div>
    {#if links.length}
      <div class="flex flex-wrap items-center gap-2 border-t border-border/40 px-4 py-3">
        {#each links as link}
          <a href={text(link.url)} target="_blank" rel="noopener noreferrer" class="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border px-2.5 text-xs font-medium text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground">
            {platformLabel(text(link.platform))}
            <ExternalLink size={12} class="opacity-40" />
          </a>
        {/each}
      </div>
    {/if}
  </article>
{/if}
