<script lang="ts">
  import { ExternalLink, Music4 } from 'lucide-svelte'
  import type { MicroPostScreenMusic } from '@gbfm/api/post'
  import { Match } from 'effect'

  let { music }: { music: MicroPostScreenMusic } = $props()

  const entity = $derived(music.entity)

  const links = $derived(music.links)

  const type = $derived(entity.type)

  const musicLabel = $derived(
    Match.value(type).pipe(
      Match.when('album', () => 'Album'),
      Match.when('track', () => 'Track'),
      Match.when('playlist', () => 'Playlist'),
      Match.exhaustive,
    ),
  )

  const platformLabel = (platform: string) =>
    Match.value(platform).pipe(
      Match.when('spotify', () => 'Spotify'),
      Match.when('youtube', () => 'YouTube'),
      Match.when('youtube_music', () => 'YouTube Music'),
      Match.when('apple_music', () => 'Apple Music'),
      Match.when('bandcamp', () => 'Bandcamp'),
      Match.when('soundcloud', () => 'SoundCloud'),
      Match.when('tidal', () => 'Tidal'),
      Match.when('deezer', () => 'Deezer'),
      Match.when('musicbrainz', () => 'MusicBrainz'),
      Match.orElse(() => platform || 'Link'),
    )
</script>

<article class="not-prose min-w-0 overflow-hidden rounded-md border border-border/50 bg-muted/20">
  <div class="flex items-start gap-4 p-4 sm:gap-5">
    <div
      class="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted sm:size-32"
    >
      {#if entity.coverImageUrl}
        <img src={entity.coverImageUrl} alt={entity.title} class="size-full object-cover" />
      {:else}
        <Music4 class="size-10 text-muted-foreground/70" aria-hidden="true" />
      {/if}
    </div>
    <div class="min-w-0 flex-1 space-y-2">
      <p class="text-xs font-medium text-muted-foreground">
        {musicLabel}
      </p>
      <h2
        class="break-words text-lg font-bold leading-snug tracking-tight text-foreground sm:text-xl"
      >
        {entity.title}
      </h2>
      {#if entity.artistNames?.length}
        <p class="text-sm text-muted-foreground">{entity.artistNames.join(', ')}</p>
      {/if}
    </div>
  </div>
  {#if links.length}
    <div class="flex flex-wrap items-center gap-2 border-t border-border/40 px-4 py-3">
      {#each links as link}
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border px-2.5 text-xs font-medium text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground"
        >
          {platformLabel(link.platform)}
          <ExternalLink size={12} class="opacity-40" />
        </a>
      {/each}
    </div>
  {/if}
</article>
