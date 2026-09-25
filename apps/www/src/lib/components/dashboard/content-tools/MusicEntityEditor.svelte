<script lang="ts">
  import { AlbumResponse, ArtistResponse, LabelResponse, TrackResponse } from '@gbfm/api/music'
  import { Match, Schema } from 'effect'
  import { onMount } from 'svelte'
  import Page from '../Page.svelte'
  import { dashboardCommand, dashboardJson, jsonRequest } from '../api'

  const Link = Schema.Struct({ id: Schema.String, platform: Schema.String, url: Schema.String, status: Schema.String })

  type EntityType = 'artist' | 'album' | 'track' | 'playlist' | 'label'

  let { entityType, id }: { entityType: EntityType; id: string } = $props()

  let form = $state<Record<string, string>>({}), name = $state(''), image = $state(''), createdAt = $state(''), updatedAt = $state(''), links = $state<ReadonlyArray<typeof Link.Type>>([]), platform = $state('spotify'), linkUrl = $state(''), pending = $state(false), message = $state('')

  const fields = $derived(Match.value(entityType).pipe(
    Match.when('artist', () => ['name','slug','bio','imageUrl','genres','publishedAt']),
    Match.when('album', () => ['title','slug','artistNames','releaseDate','coverImageUrl','genres','albumType','publishedAt']),
    Match.when('track', () => ['title','slug','artistNames','coverImageUrl','albumId','trackNumber','publishedAt']),
    Match.orElse(() => ['name','slug','description','imageUrl','bannerImageUrl','content','tags','genres','publishedAt'])
  ))

  const plural = $derived(`${entityType}s`)

  async function load() { pending = true;

 try { const endpoint = `/api/music/${plural}/${id}`;

 if (entityType === 'artist') { const entity = await dashboardJson(ArtistResponse, endpoint); form = { name: entity.name, slug: entity.slug, bio: entity.bio ?? '', imageUrl: entity.imageUrl ?? '', genres: entity.genres?.join(', ') ?? '', publishedAt: entity.publishedAt ?? '' }; name = entity.name; image = entity.imageUrl ?? ''; createdAt = entity.createdAt; updatedAt = entity.updatedAt } else if (entityType === 'album') { const entity = await dashboardJson(AlbumResponse, endpoint); form = { title: entity.title, slug: entity.slug, artistNames: entity.artistNames?.join(', ') ?? '', releaseDate: entity.releaseDate ?? '', coverImageUrl: entity.coverImageUrl ?? '', genres: entity.genres?.join(', ') ?? '', albumType: entity.albumType ?? '', publishedAt: entity.publishedAt ?? '' }; name = entity.title; image = entity.coverImageUrl ?? ''; createdAt = entity.createdAt; updatedAt = entity.updatedAt } else if (entityType === 'track') { const entity = await dashboardJson(TrackResponse, endpoint); form = { title: entity.title, slug: entity.slug, artistNames: entity.artistNames?.join(', ') ?? '', coverImageUrl: entity.coverImageUrl ?? '', albumId: entity.albumId ?? '', trackNumber: entity.trackNumber?.toString() ?? '', publishedAt: entity.publishedAt ?? '' }; name = entity.title; image = entity.coverImageUrl ?? ''; createdAt = entity.createdAt; updatedAt = entity.updatedAt } else if (entityType === 'label') { const entity = await dashboardJson(LabelResponse, endpoint); form = { name: entity.name, slug: entity.slug, description: entity.description ?? '', imageUrl: entity.imageUrl ?? '', bannerImageUrl: entity.bannerImageUrl ?? '', content: entity.content, tags: entity.tags?.join(', ') ?? '', genres: entity.genres?.join(', ') ?? '', publishedAt: entity.publishedAt ?? '' }; name = entity.name; image = entity.imageUrl ?? ''; createdAt = entity.createdAt; updatedAt = entity.updatedAt } else { message = 'Edit playlists in Playlist Management.';

 return }

      links = await dashboardJson(Schema.Array(Link), `/api/music/${entityType}/${id}/links`)
    } catch { message = 'Could not load entity.' } finally { pending = false } }

  const payload = () => Object.fromEntries(fields.map((key) => { const value = form[key]?.trim() ?? '';

 if (['genres','artistNames','tags'].includes(key)) return [key, value ? value.split(',').map((item) => item.trim()).filter(Boolean) : null];

 if (key === 'trackNumber') return [key, value ? Number(value) : null];

 return [key, value || null] }))

  async function save() { pending = true;

 try { const responseSchema = Match.value(entityType).pipe(Match.when('artist', () => ArtistResponse), Match.when('album', () => AlbumResponse), Match.when('track', () => TrackResponse), Match.orElse(() => LabelResponse)); await dashboardJson(responseSchema, `/api/music/${plural}/${id}`, jsonRequest('PATCH', payload())); message = 'Entity saved.'; await load() } catch { message = 'Could not save entity.' } finally { pending = false } }

  async function addLink() { try { await dashboardJson(Link, `/api/music/${entityType}/${id}/links`, jsonRequest('POST', { platform, url: linkUrl, status: 'verified' })); linkUrl = ''; await load() } catch { message = 'Could not add link.' } }

  async function removeLink(linkId: string) { try { await dashboardCommand(`/api/music/${entityType}/${id}/links/${linkId}`, { method: 'DELETE' }); await load() } catch { message = 'Could not delete link.' } }

  async function removeEntity() { if (!confirm(`Delete ${name}? This cannot be undone.`)) return;

 try { await dashboardCommand(`/api/music/${plural}/${id}`, { method: 'DELETE' }); location.href = '/dashboard/music' } catch { message = 'Could not delete entity.' } }

  onMount(load)
</script>
<Page title={`Edit ${entityType}`} description="Manage catalog metadata, publishing and source links."><a class="inline-block text-sm underline" href="/dashboard/music">← Music catalog</a>
  {#if entityType === 'playlist'}<p class="rounded border p-6">Playlist metadata and tracks are managed in <a class="underline" href="/dashboard/playlists">Playlist Management</a>.</p>{:else if pending && !name}<p>Loading…</p>{:else}<header class="flex items-center gap-4 rounded border p-4">{#if image}<img class="size-20 rounded object-cover" src={image} alt="" />{/if}<div class="flex-1"><h2 class="text-2xl font-bold">{name}</h2><p class="text-xs text-muted-foreground">Created {createdAt ? new Date(createdAt).toLocaleString() : '—'} · Updated {updatedAt ? new Date(updatedAt).toLocaleString() : '—'}</p></div><button class="rounded bg-destructive px-3 py-2 text-destructive-foreground" onclick={() => void removeEntity()}>Delete</button></header>
  <form class="grid gap-4 rounded border p-4 sm:grid-cols-2" onsubmit={(event) => { event.preventDefault(); void save() }}>{#each fields as field}<label class:sm:col-span-2={field === 'bio' || field === 'content' || field === 'description'}><span class="block capitalize">{field.replace(/([A-Z])/g, ' $1')}</span>{#if field === 'bio' || field === 'content' || field === 'description'}<textarea class="block min-h-28 w-full rounded border bg-background p-2" bind:value={form[field]}></textarea>{:else}<input class="block w-full rounded border bg-background p-2" type={field === 'publishedAt' || field === 'releaseDate' ? 'datetime-local' : field === 'trackNumber' ? 'number' : 'text'} bind:value={form[field]} />{/if}</label>{/each}<button class="w-fit rounded bg-foreground px-4 py-2 text-background" disabled={pending}>{pending ? 'Saving…' : 'Save metadata'}</button></form>
  <section class="space-y-3 rounded border p-4"><h2 class="font-bold">Source links</h2><form class="flex flex-wrap gap-2" onsubmit={(event) => { event.preventDefault(); void addLink() }}><select class="rounded border bg-background p-2" bind:value={platform}><option>spotify</option><option>bandcamp</option><option>soundcloud</option><option>youtube</option><option>apple_music</option></select><input required type="url" class="min-w-64 flex-1 rounded border bg-background p-2" placeholder="https://…" bind:value={linkUrl}/><button class="rounded border px-4">Add link</button></form><ul class="divide-y">{#each links as link}<li class="flex items-center gap-3 py-2"><span class="rounded bg-muted px-2 py-1 text-xs">{link.platform}</span><a class="min-w-0 flex-1 truncate underline" href={link.url} target="_blank" rel="noreferrer">{link.url}</a><span>{link.status}</span><button class="text-destructive underline" onclick={() => void removeLink(link.id)}>Remove</button></li>{/each}</ul></section>{/if}{#if message}<p aria-live="polite">{message}</p>{/if}
</Page>
