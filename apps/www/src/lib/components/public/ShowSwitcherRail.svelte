<script lang="ts">
  import { text, type PublicRecord } from '@/lib/public-content'

  let {
    shows,
    selectedId,
    onSelect,
  }: {
    shows: ReadonlyArray<PublicRecord>
    selectedId: string
    onSelect?: (show: PublicRecord, event: MouseEvent) => void
  } = $props()
</script>

<nav aria-label="Show switcher" class="no-scrollbar flex gap-2 overflow-x-auto">
  {#each shows as show (text(show.id))}
    {@const selected = text(show.id) === selectedId}
    <a
      href={`/shows/${text(show.slug)}`}
      onclick={(event) => onSelect?.(show, event)}
      aria-current={selected ? 'page' : undefined}
      class={[
        'shrink-0 whitespace-nowrap rounded-sm border px-2.5 py-1 text-xs font-semibold no-underline transition-colors',
        selected
          ? 'border-highlight bg-secondary text-highlight'
          : 'border-border text-foreground/70 hover:bg-muted/40',
      ]}>{text(show.title, 'Untitled show')}</a
    >
  {/each}
</nav>
