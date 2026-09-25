<script lang="ts">
  import Artwork from './Artwork.svelte'
  import AudioList from './AudioList.svelte'
  import PublicActions from './PublicActions.svelte'
  import PublicHead from './PublicHead.svelte'
  import PublicState from './PublicState.svelte'
  import { records, text, type PublicRecord } from '@/lib/public-content'
  let { shows, selected, episodes = [], failure = null, actionActive = false }: { shows: ReadonlyArray<PublicRecord>; selected: PublicRecord | null; episodes?: ReadonlyArray<PublicRecord>; failure?: string | null; actionActive?: boolean } = $props()
  const hosts = $derived(records(selected?.hosts).map((host) => text(host.name)).filter(Boolean).join(', '))
</script>

<PublicHead title={selected ? text(selected.title, 'Radio Shows') : 'Radio Shows'} description={selected ? text(selected.description, 'Listen to radio shows on goosebumps.fm.') : 'Regular radio shows, hosts and episodes on goosebumps.fm.'} canonical={selected ? `/shows/${text(selected.slug)}` : '/shows'} image={selected ? text(selected.thumbnailUrl) || undefined : undefined} />
{#if failure}<PublicState message={failure} error />{:else}
<div class="grid w-full grid-cols-1 gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[220px_minmax(0,1fr)_240px] lg:gap-10">
  <aside>{#if selected}<h2 class="mb-2 border-b border-border/60 pb-2 text-xs font-semibold tracking-wider text-muted-foreground">Show</h2><div class="font-mono"><Artwork src={text(selected.thumbnailUrl) || undefined} alt={text(selected.title, 'Radio show')} /><h1 class="mt-3 text-lg font-bold">{text(selected.title)}</h1>{#if hosts}<p class="mt-1 text-xs text-muted-foreground">hosted by {hosts}</p>{/if}{#if text(selected.description)}<p class="mt-3 border-t border-border/40 pt-3 text-xs leading-relaxed text-muted-foreground">{text(selected.description)}</p>{/if}<div class="mt-4"><PublicActions id={text(selected.id)} title={text(selected.title)} kind="show" slug={`/shows/${text(selected.slug)}`} initialActive={actionActive} /></div></div>{/if}</aside>
  <main class="min-w-0">{#if selected}<h2 class="mb-3 border-b border-border/60 pb-2 text-xs font-semibold tracking-wider text-muted-foreground">Episodes</h2><AudioList items={episodes} />{:else}<PublicState message="Select a show to browse its mixes." />{/if}</main>
  <aside><h2 class="mb-2 border-b border-border/60 pb-2 text-xs font-semibold tracking-wider text-muted-foreground">All shows</h2><nav aria-label="Shows" class="grid font-mono">{#each shows as show}<a href={`/shows/${text(show.slug)}`} aria-current={text(show.id) === text(selected?.id) ? 'page' : undefined} class="border-b border-border/40 py-2 text-sm font-bold no-underline hover:text-highlight aria-[current=page]:text-highlight">{text(show.title, 'Untitled show')}</a>{/each}</nav></aside>
</div>
{/if}
