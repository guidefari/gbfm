<script lang="ts">
  import { Pause, Play } from 'lucide-svelte'
  import { records, text, type PublicRecord } from '@/lib/public-content'

  let { episode, active, playing, onPlay }: { episode: PublicRecord; active: boolean; playing: boolean; onPlay: () => void } = $props()
  const title = $derived(text(episode.title, 'Untitled episode'))
  const creators = $derived(records(episode.creators))
  const createdAt = $derived(text(episode.createdAt))
  const dateLabel = $derived(createdAt ? new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '')
</script>

<article data-testid="episode-row" class={['group/item flex max-w-2xl items-center gap-2 border-b border-border/40 px-1 py-1.5 text-base transition-colors last:border-b-0', active && 'text-highlight']}>
  {#if text(episode.url)}
    <button type="button" aria-label={active && playing ? `Pause ${title}` : `Play ${title}`} onclick={onPlay} class={['grid size-7 shrink-0 place-items-center rounded-sm transition-opacity hover:text-highlight', !active && 'opacity-40 group-hover/item:opacity-100 group-focus-within/item:opacity-100']}>
      {#if active && playing}<Pause size={16} strokeWidth={2} />{:else}<Play size={16} strokeWidth={2} />{/if}
    </button>
  {/if}
  <a href={`/mixes/${text(episode.slug, text(episode.id))}`} class={['min-w-0 shrink truncate no-underline transition-colors group-hover/item:text-highlight', active ? 'text-highlight' : 'text-foreground']}>{title}</a>
  {#if dateLabel}<span class="shrink-0 text-[11px] tracking-widest text-muted-foreground">{dateLabel}</span>{/if}
  {#if creators.length > 0}
    <span class="hidden min-w-0 truncate text-muted-foreground sm:inline">
      {#each creators as creator, index}
        {#if text(creator.username)}<a href={`/profile/${text(creator.username)}`} class="text-muted-foreground no-underline decoration-highlight/50 underline-offset-4 hover:underline">{text(creator.name)}</a>{:else}<span>{text(creator.name)}</span>{/if}{#if index < creators.length - 1}<span class="mx-1 opacity-50">&</span>{/if}
      {/each}
    </span>
  {/if}
</article>
