<script lang="ts">
  import { GetMixQRPdfResponse } from '@gbfm/api/audio'
  import { page } from '$app/state'
  import { Option, Schema } from 'effect'
  import Artwork from './Artwork.svelte'
  import PublicActions from './PublicActions.svelte'
  import RichContent from './RichContent.svelte'
  import { getPlayerContext } from '@/lib/player/context'
  import { records, text, type PublicRecord } from '@/lib/public-content'

  let { item, kind, canonical, relatedShow = null }: { item: PublicRecord; kind: string; canonical: string; relatedShow?: PublicRecord | null } = $props()
  const player = getPlayerContext()
  const snapshot = player.snapshot
  let actionStatus = $state('')
  let qrBusy = $state(false)
  const value = (...keys: string[]) => {
    for (const key of keys) {
      const candidate = text(item[key])
      if (candidate) return candidate
    }
    return ''
  }
  const title = $derived(value('title', 'name') || 'Untitled')
  const tags = $derived(Array.isArray(item.tags) ? item.tags : [])
  const creators = $derived(records(item.creators))
  const links = $derived(records(item.streamingLinks ?? item.streamLinks))
  const date = $derived(value('releaseDate', 'createdAt'))
  const actionKind = $derived<'audio' | 'show' | 'content'>(value('url') ? 'audio' : kind.toLowerCase().includes('show') ? 'show' : 'content')
  const isMix = $derived(kind.toLowerCase() === 'mix')
  const track = $derived({
    url: value('url'),
    title,
    id: value('id', 'url'),
    slug: value('slug'),
    type: kind.toLowerCase() === 'mix' ? 'mix' as const : kind.toLowerCase() === 'track' ? 'track' as const : 'misc' as const,
    thumbnailUrl: value('thumbnailUrl', 'imageUrl', 'image') || null
  })
  const current = $derived($snapshot ? ($snapshot.queue.tracks[$snapshot.queue.currentIndex] ?? null) : null)
  const isCurrent = $derived(current?.id === track.id)
  const role = $derived(page.data.principal?._tag === 'Authenticated' ? page.data.principal.role : 'user')

  const play = () => {
    if (isCurrent) player.toggle()
    else player.play(track)
  }
  const enqueue = () => {
    player.enqueue(track)
    actionStatus = 'Added to queue'
  }
  const downloadQr = async () => {
    if (qrBusy) return
    qrBusy = true
    actionStatus = 'Generating QR PDF…'
    const response = await fetch(`/api/content/audio/mix/${encodeURIComponent(value('slug'))}/qr-pdf`).catch(() => null)
    const json: unknown = response?.ok ? await response.json() : null
    const pdf = Option.getOrNull(Schema.decodeUnknownOption(GetMixQRPdfResponse)(json))
    if (pdf) {
      window.open(pdf.url, '_blank', 'noopener,noreferrer')
      actionStatus = 'QR PDF ready'
    } else actionStatus = 'Could not generate QR PDF'
    qrBusy = false
  }
</script>

<article class="mx-auto max-w-3xl px-4 py-8">
  {#if isMix}<a href={relatedShow ? `/shows/${text(relatedShow.slug)}` : '/shows'} class="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-foreground">← {relatedShow ? text(relatedShow.title, 'Radio shows') : 'Radio shows'}</a>{/if}
  <header class="mb-8 grid gap-6 sm:grid-cols-[minmax(0,15rem)_1fr] sm:items-end">
    <Artwork src={value('thumbnailUrl', 'imageUrl', 'image', 'bannerImageUrl')} alt={title} />
    <div>
      <p class="mb-2 text-xs font-bold uppercase tracking-widest text-highlight">{kind}</p>
      <h1 class="m-0 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
      {#if value('description')}<p class="mt-4 text-lg text-muted-foreground">{value('description')}</p>{/if}
      {#if relatedShow}<p class="mt-3 text-sm text-muted-foreground">from <a class="font-bold text-foreground" href={`/shows/${text(relatedShow.slug)}`}>{text(relatedShow.title, 'Radio show')}</a></p>{/if}
      {#if creators.length || date}<p class="mt-3 text-sm text-muted-foreground">{#each creators as creator, index}{#if index}, {/if}<a class="font-bold text-foreground" href={text(creator.username) ? `/profile/${creator.username}` : undefined}>{text(creator.name, text(creator.username, 'Unknown'))}</a>{/each}{#if creators.length && date} · {/if}{#if date}<time datetime={date}>{new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</time>{/if}</p>{/if}
    </div>
  </header>

  <div class="mb-8 flex flex-wrap gap-3">
    {#if value('url')}<button class="border-2 border-foreground bg-highlight px-5 py-3 font-bold text-highlight-foreground" onclick={play}>{isCurrent && $snapshot?.playing ? 'Ⅱ Pause' : '▶ Play'}</button>{/if}
    <PublicActions id={value('id') || undefined} {title} kind={actionKind} slug={canonical} />
    {#if isMix && value('url')}<button class="border border-border px-3 py-2 text-sm font-bold" onclick={enqueue}>Add to queue</button>{/if}
    {#if isMix && ['creator', 'admin'].includes(role)}<button class="border border-border px-3 py-2 text-sm font-bold" disabled={qrBusy} onclick={downloadQr}>{qrBusy ? 'Generating…' : 'Download QR'}</button>{/if}
    {#if isMix && role === 'admin'}<a class="border border-border px-3 py-2 text-sm font-bold no-underline" href={`/mix-upload?edit=${encodeURIComponent(value('slug'))}`}>Edit</a>{/if}
    {#if actionStatus}<span class="self-center text-xs text-muted-foreground" role="status">{actionStatus}</span>{/if}
  </div>

  {#if links.length}<nav aria-label="Listen on" class="mb-8 flex flex-wrap gap-2">{#each links as link}{@const href = text(link.url)}{#if href}<a href={href} target="_blank" rel="noopener noreferrer" class="border border-border px-3 py-2 text-sm font-bold">{text(link.platform, 'Listen')} ↗</a>{/if}{/each}</nav>{/if}

  {#if value('content', 'mdx', 'body')}
    <RichContent content={value('content', 'mdx', 'body')} />
  {/if}

  {#if tags.length > 0}
    <footer class="mt-8 flex flex-wrap gap-3 border-t border-border pt-4">
      {#each tags as tag}
        {@const label = typeof tag === 'string' ? tag : (tag && typeof tag === 'object' && 'name' in tag ? String(tag.name) : '')}
        {#if label}<a class="text-sm text-muted-foreground" href={`/tags/${encodeURIComponent(label)}`}>#{label}</a>{/if}
      {/each}
    </footer>
  {/if}
</article>
