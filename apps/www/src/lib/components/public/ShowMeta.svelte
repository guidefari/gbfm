<script lang="ts">
  import Artwork from './Artwork.svelte'
  import PublicActions from './PublicActions.svelte'
  import { records, text, type PublicRecord } from '@/lib/public-content'

  let { show, actionActive = false }: { show: PublicRecord; actionActive?: boolean } = $props()
  const title = $derived(text(show.title, 'Radio show'))
  const hosts = $derived(records(show.hosts).map((host) => text(host.name)).filter(Boolean).join(', '))
</script>

<header class="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-4 font-mono sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
  <Artwork src={text(show.thumbnailUrl) || undefined} alt={title} />
  <div class="min-w-0">
    <h1 class="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
    {#if hosts}<p class="mt-1 text-xs text-muted-foreground">hosted by {hosts}</p>{/if}
    {#if text(show.description)}<p class="mt-3 hidden max-w-prose text-sm leading-relaxed text-muted-foreground sm:line-clamp-3">{text(show.description)}</p>{/if}
    <div class="mt-4"><PublicActions id={text(show.id)} {title} kind="show" slug={`/shows/${text(show.slug)}`} initialActive={actionActive} /></div>
  </div>
  {#if text(show.description)}<p class="col-span-2 text-sm leading-relaxed text-muted-foreground sm:hidden">{text(show.description)}</p>{/if}
</header>
