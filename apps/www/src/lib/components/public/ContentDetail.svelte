<script lang="ts">
  import { GetMixQRPdfResponse } from '@gbfm/api/audio'
  import { page } from '$app/state'
  import { Match, Option, Schema } from 'effect'
  import { buttonVariants } from '@gbfm/ui/button-variants'
  import { Pause, Play } from 'lucide-svelte'
  import { cn } from '@/lib/utils'
  import Artwork from './Artwork.svelte'
  import PublicActions from './PublicActions.svelte'
  import RichContent from './RichContent.svelte'
  import { getPlayerContext } from '@/lib/player/context'
  import { records, text, type PublicRecord } from '@/lib/public-content'

  let {
    item,
    kind,
    canonical,
    relatedShow = null,
    actionActive = false,
  }: {
    item: PublicRecord
    kind: string
    canonical: string
    relatedShow?: PublicRecord | null
    actionActive?: boolean
  } = $props()

  const player = getPlayerContext()

  const snapshot = player.snapshot

  let actionStatus = $state('')

  let qrBusy = $state(false)

  const value = (...keys: Array<string>) => {
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

  const actionKind = $derived<'audio' | 'show' | 'content'>(
    Match.value({
      hasUrl: Boolean(value('url')),
      isShow: kind.toLowerCase().includes('show'),
    }).pipe(
      Match.when({ hasUrl: true }, () => 'audio' as const),
      Match.when({ isShow: true }, () => 'show' as const),
      Match.orElse(() => 'content' as const),
    ),
  )

  const isMix = $derived(kind.toLowerCase() === 'mix')

  const track = $derived({
    url: value('url'),
    title,
    id: value('id', 'url'),
    slug: value('slug'),
    type: Match.value(kind.toLowerCase()).pipe(
      Match.when('mix', () => 'mix' as const),
      Match.when('track', () => 'track' as const),
      Match.orElse(() => 'misc' as const),
    ),
    thumbnailUrl: value('thumbnailUrl', 'imageUrl', 'image') || null,
  })

  const current = $derived(
    $snapshot ? ($snapshot.queue.tracks[$snapshot.queue.currentIndex] ?? null) : null,
  )

  const isCurrent = $derived(current?.id === track.id)

  const role = $derived(
    page.data.principal?._tag === 'Authenticated' ? page.data.principal.role : 'user',
  )

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

    const response = await fetch(
      `/api/content/audio/mix/${encodeURIComponent(value('slug'))}/qr-pdf`,
    ).catch(() => null)

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
  {#if isMix}<a
      href={relatedShow ? `/shows/${text(relatedShow.slug)}` : '/shows'}
      class="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-foreground"
      >← {relatedShow ? text(relatedShow.title, 'Radio shows') : 'Radio shows'}</a
    >{/if}
  <header class="mb-8 grid gap-6 sm:grid-cols-[minmax(0,15rem)_1fr] sm:items-end">
    <Artwork src={value('thumbnailUrl', 'imageUrl', 'image', 'bannerImageUrl')} alt={title} />
    <div>
      <p class="mb-2 text-xs font-bold uppercase tracking-widest text-highlight">{kind}</p>
      <h1 class="m-0 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
      {#if value('description')}<p class="mt-4 text-lg text-muted-foreground">
          {value('description')}
        </p>{/if}
      {#if relatedShow}<p class="mt-3 text-sm text-muted-foreground">
          from <a class="font-bold text-foreground" href={`/shows/${text(relatedShow.slug)}`}
            >{text(relatedShow.title, 'Radio show')}</a
          >
        </p>{/if}
      {#if creators.length || date}<p class="mt-3 text-sm text-muted-foreground">
          {#each creators as creator, index}{#if index},
            {/if}<a
              class="font-bold text-foreground"
              href={text(creator.username) ? `/profile/${creator.username}` : undefined}
              >{text(creator.name, text(creator.username, 'Unknown'))}</a
            >{/each}{#if creators.length && date}
            ·
          {/if}{#if date}<time datetime={date}
              >{new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}</time
            >{/if}
        </p>{/if}
    </div>
  </header>

  <div class="mb-8 flex flex-wrap items-center gap-3">
    {#if value('url')}<button class={buttonVariants({ size: 'lg' })} onclick={play}
        >{#if isCurrent && $snapshot?.playing}<Pause
            class="mr-2 size-4"
            fill="currentColor"
          />Pause{:else}<Play class="mr-2 size-4" fill="currentColor" />Play{/if}</button
      >{/if}
    <PublicActions
      {...value('id') ? { id: value('id') } : {}}
      {title}
      kind={actionKind}
      slug={canonical}
      initialActive={actionActive}
    />
    {#if isMix && value('url')}<button
        class={buttonVariants({ variant: 'outline', size: 'sm' })}
        onclick={enqueue}>Add to queue</button
      >{/if}
    {#if isMix && ['creator', 'admin'].includes(role)}<button
        class={buttonVariants({ variant: 'outline', size: 'sm' })}
        disabled={qrBusy}
        onclick={downloadQr}>{qrBusy ? 'Generating…' : 'Download QR'}</button
      >{/if}
    {#if isMix && role === 'admin'}<a
        class={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'no-underline')}
        href={`/mix-upload?edit=${encodeURIComponent(value('slug'))}`}>Edit</a
      >{/if}
    {#if actionStatus}<span class="self-center text-xs text-muted-foreground" role="status"
        >{actionStatus}</span
      >{/if}
  </div>

  {#if links.length}<nav aria-label="Listen on" class="mb-8 flex flex-wrap gap-2">
      {#each links as link}{@const href = text(link.url)}{#if href}<a
            {href}
            target="_blank"
            rel="noopener noreferrer"
            class="border border-border px-3 py-2 text-sm font-bold"
            >{text(link.platform, 'Listen')} ↗</a
          >{/if}{/each}
    </nav>{/if}

  {#if value('content', 'mdx', 'body')}
    <RichContent content={value('content', 'mdx', 'body')} />
  {/if}

  {#if tags.length > 0}
    <footer class="mt-8 flex flex-wrap gap-3 border-t border-border pt-4">
      {#each tags as tag}
        {@const label =
          typeof tag === 'string'
            ? tag
            : tag && typeof tag === 'object' && 'name' in tag
              ? String(tag.name)
              : ''}
        {#if label}<a
            class="text-sm text-muted-foreground"
            href={`/tags/${encodeURIComponent(label)}`}>#{label}</a
          >{/if}
      {/each}
    </footer>
  {/if}
</article>
