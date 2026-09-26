<script lang="ts">
  import Artwork from './Artwork.svelte'
  import PublicActions from './PublicActions.svelte'
  import { records, text, type PublicRecord } from '@/lib/public-content'

  let {
    show,
    actionActive = false,
    showActions = true,
  }: {
    show: PublicRecord
    actionActive?: boolean | Promise<boolean>
    showActions?: boolean
  } = $props()

  const title = $derived(text(show.title, 'Radio show'))

  const hosts = $derived(
    records(show.hosts)
      .map((host) => text(host.name))
      .filter(Boolean)
      .join(', '),
  )
</script>

<div class="min-w-0 font-mono">
  <Artwork {...text(show.thumbnailUrl) ? { src: text(show.thumbnailUrl) } : {}} alt={title} />
  <h1 class="mt-3 text-lg font-bold tracking-tight text-foreground">{title}</h1>
  {#if hosts}<p class="mt-1 text-xs text-muted-foreground">hosted by {hosts}</p>{/if}
  {#if text(show.description)}<p
      class="mt-3 border-t border-border/40 pt-3 text-xs leading-relaxed text-muted-foreground"
    >
      {text(show.description)}
    </p>{/if}
  {#if showActions}
    <div class="mt-4 min-h-7">
      {#await actionActive then active}
        <PublicActions
          id={text(show.id)}
          {title}
          kind="show"
          slug={`/shows/${text(show.slug)}`}
          initialActive={active}
          compact
        />
      {/await}
    </div>
  {/if}
</div>
