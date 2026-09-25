<script lang="ts">
  import { ArtistListResponse, AlbumListResponse, TrackListResponse, LabelListResponse, PlaylistListResponse, LabelResponse } from '@gbfm/api/music'
  import { onMount } from 'svelte'
  import Page from '../Page.svelte'
  import { dashboardJson, jsonRequest } from '../api'

  type Tab = 'artists' | 'albums' | 'tracks' | 'playlists' | 'labels'

  type Row = { id: string; name: string; detail: string; image: string | null; publishedAt: string | null }

  let tab = $state<Tab>('artists'), rows = $state<Array<Row>>([]), pending = $state(false), message = $state('')

  async function load() { pending = true; message = '';

 try {
    if (tab === 'artists') rows = (await dashboardJson(ArtistListResponse, '/api/music/artists')).map((x) => ({ id: x.id, name: x.name, detail: x.slug, image: x.imageUrl, publishedAt: x.publishedAt }))

    if (tab === 'albums') rows = (await dashboardJson(AlbumListResponse, '/api/music/albums')).map((x) => ({ id: x.id, name: x.title, detail: x.artistNames?.join(', ') ?? x.slug, image: x.coverImageUrl, publishedAt: x.publishedAt }))

    if (tab === 'tracks') rows = (await dashboardJson(TrackListResponse, '/api/music/tracks')).map((x) => ({ id: x.id, name: x.title, detail: x.artistNames?.join(', ') ?? x.slug, image: x.coverImageUrl, publishedAt: x.publishedAt }))

    if (tab === 'playlists') rows = (await dashboardJson(PlaylistListResponse, '/api/music/playlists')).map((x) => ({ id: x.id, name: x.title, detail: x.slug, image: x.coverImageUrl, publishedAt: x.publishedAt }))

    if (tab === 'labels') rows = (await dashboardJson(LabelListResponse, '/api/music/labels/manage')).map((x) => ({ id: x.id, name: x.name, detail: x.slug, image: x.imageUrl, publishedAt: x.publishedAt }))
  } catch { message = 'Could not load catalog.' } finally { pending = false } }

  async function createLabel() { try { const label = await dashboardJson(LabelResponse, '/api/music/labels', jsonRequest('POST', { name: 'Untitled label', slug: `untitled-label-${Date.now()}`, content: '' })); location.href = `/dashboard/music-entity/label/${label.id}` } catch { message = 'Could not create label.' } }

  onMount(load)
</script>
<Page title="Music Catalog" description="Artists, albums, tracks, playlists, and record labels.">
  <section class="overflow-hidden rounded border"><header class="flex flex-wrap items-center justify-between gap-3 border-b p-4"><p class="text-sm text-muted-foreground">Switch entity types without leaving the catalog.</p><nav class="flex flex-wrap rounded bg-muted p-1">{#each ['artists','albums','tracks','playlists','labels'] as value}<button class:font-bold={tab === value} class="rounded px-3 py-1.5 capitalize" onclick={() => { tab = value as Tab; void load() }}>{value}</button>{/each}</nav></header>
    <div class="p-4">{#if tab === 'labels'}<div class="mb-4 flex justify-end"><button class="rounded bg-foreground px-3 py-2 text-background" onclick={() => void createLabel()}>New label</button></div>{/if}
    {#if pending}<p class="p-6 text-center text-muted-foreground">Loading {tab}…</p>{:else}<ul class="divide-y rounded border">{#each rows as row}<li class="flex items-center gap-4 p-3 hover:bg-muted/40">{#if row.image}<img class="size-10 rounded object-cover" src={row.image} alt="" />{:else}<span class="size-10 rounded bg-muted"></span>{/if}<div class="min-w-0 flex-1"><strong>{row.name}</strong><span class="block truncate text-xs text-muted-foreground">{row.detail}</span></div><span class="rounded bg-muted px-2 py-1 text-xs">{row.publishedAt ? 'Published' : 'Draft'}</span><a class="rounded border px-3 py-1.5 no-underline" href={tab === 'playlists' ? '/dashboard/playlists' : `/dashboard/music-entity/${tab.slice(0,-1)}/${row.id}`}>Edit</a></li>{/each}{#if rows.length === 0}<li class="p-8 text-center text-muted-foreground">No {tab} found.</li>{/if}</ul>{/if}</div>
  </section>{#if message}<p>{message}</p>{/if}
</Page>
