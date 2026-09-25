<script lang="ts">
  import { invalidateAll } from '$app/navigation'
  import { ImageDown, Link2, MessageSquareQuote } from 'lucide-svelte'
  import PublicHead from '@/lib/components/public/PublicHead.svelte'
  import PublicState from '@/lib/components/public/PublicState.svelte'
  import RichContent from '@/lib/components/public/RichContent.svelte'
  import TweetAuthorRow from '@/lib/components/public/TweetAuthorRow.svelte'
  import TweetMusicCard from '@/lib/components/public/TweetMusicCard.svelte'
  import TweetNav from '@/lib/components/public/TweetNav.svelte'
  import { record, records, strings, text } from '@/lib/public-content'
  import type { PageProps } from './$types'

  let { data, params }: PageProps = $props()
  let draft = $state('')
  let replyOpen = $state(false)
  let posting = $state(false)
  let status = $state('')
  let copied = $state(false)

  const title = $derived(text(data.item?.title, text(data.item?.content, 'Tweet')).slice(0, 120))
  const author = $derived(records(data.item?.creators)[0] ?? null)
  const rootIsCurrent = $derived(text(data.parent?.slug) === params.slug)

  const postReply = async () => {
    if (!draft.trim() || posting) return
    posting = true
    const response = await fetch(
      `/api/content/posts/micro/${encodeURIComponent(params.slug)}/replies`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: draft.trim() })
      }
    ).catch(() => null)
    if (response?.ok) {
      draft = ''
      replyOpen = false
      status = 'Reply posted'
      await invalidateAll()
    } else status = response?.status === 401 ? 'Sign in to reply' : 'Could not post reply'
    posting = false
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    copied = true
    setTimeout(() => (copied = false), 1800)
  }

  const download = async () => {
    if (!data.item) return
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 630
    const context = canvas.getContext('2d')
    if (!context) return
    context.fillStyle = '#16415a'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#9bd8e8'
    context.font = 'bold 44px JetBrainsMono, monospace'
    const words = text(data.item.content, title).split(/\s+/)
    let line = ''
    let y = 120
    for (const word of words) {
      const next = `${line}${word} `
      if (context.measureText(next).width > 1000) {
        context.fillText(line, 100, y)
        line = `${word} `
        y += 62
      } else line = next
    }
    context.fillText(line, 100, y)
    context.fillStyle = '#55cef6'
    context.font = 'bold 30px JetBrainsMono, monospace'
    context.fillText('goosebumps.fm', 100, 560)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const file = new File([blob], `${params.slug}.png`, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title })
    else {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = file.name
      link.click()
      URL.revokeObjectURL(link.href)
    }
  }
</script>

<PublicHead
  {title}
  description={text(data.item?.description, text(data.item?.content, 'A tweet on goosebumps.fm')).slice(0, 160)}
  canonical={`/tweet/${params.slug}`} />

{#if data.failure || !data.item}
  <PublicState message={data.failure ?? 'This tweet could not be found.'} error />
{:else}
  {@const itemMusic = record(data.item.music)}
  <div class="mx-auto max-w-3xl px-4 py-8">
    <div class="mb-6 lg:mb-0"><TweetNav slug={params.slug} initialResult={data.navigation} /></div>

    {#if data.parent && !rootIsCurrent}
      {@const parentMusic = record(data.parent.music)}
      <div class="pb-4">
        <article class="space-y-3 overflow-hidden rounded-lg border border-border/40 bg-card p-3 opacity-80 transition-opacity hover:opacity-100">
          <TweetAuthorRow creator={records(data.parent.creators)[0] ?? null} createdAt={text(data.parent.createdAt)} interactive={false} />
          <a href={`/tweet/${text(data.parent.slug)}`} class="block no-underline">
            <p class="mt-2 truncate text-base text-muted-foreground">{text(data.parent.content, text(data.parent.title))}</p>
          </a>
          {#if parentMusic}
            <TweetMusicCard type={text(data.parent.musicEntityType)} entity={record(parentMusic.entity)} links={records(parentMusic.links)} />
          {/if}
        </article>
        <div class="relative h-2"><div class="absolute left-5 top-0 h-2 w-px bg-border/60" aria-hidden="true"></div></div>
      </div>
    {/if}

    <article class="space-y-4 rounded-lg border border-border/60 bg-card/60 p-4 shadow-sm sm:p-5">
      <TweetAuthorRow creator={author} createdAt={text(data.item.createdAt)} />

      {#if text(data.item.title)}
        <h1 class="text-lg font-medium leading-snug tracking-tight">{text(data.item.title)}</h1>
      {/if}

      <div class="prose prose-base max-w-none text-foreground prose-headings:font-black prose-headings:tracking-tighter prose-p:my-0 prose-p:leading-relaxed prose-a:text-foreground prose-a:underline dark:prose-invert">
        <RichContent content={text(data.item.content)} />
      </div>

      {#if itemMusic}
        <TweetMusicCard type={text(data.item.musicEntityType)} entity={record(itemMusic.entity)} links={records(itemMusic.links)} />
      {/if}

      {#if data.quote}
        {@const quoteMusic = record(data.quote.music)}
        <article class="not-prose space-y-3 overflow-hidden rounded-md border border-border/50 bg-muted/20 p-3 transition-colors hover:bg-muted/30">
          <TweetAuthorRow creator={records(data.quote.creators)[0] ?? null} createdAt={text(data.quote.createdAt)} interactive={false} />
          <a href={`/tweet/${text(data.quote.slug)}`} class="block no-underline">
            <p class="mt-2 truncate text-base text-muted-foreground">{text(data.quote.content, text(data.quote.title))}</p>
          </a>
          {#if quoteMusic}
            <TweetMusicCard type={text(data.quote.musicEntityType)} entity={record(quoteMusic.entity)} links={records(quoteMusic.links)} />
          {/if}
        </article>
      {/if}

      {#if strings(data.item.tags).length}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          {#each strings(data.item.tags) as tag}
            <a href={`/tags/${encodeURIComponent(tag)}`} class="text-xs font-medium text-muted-foreground no-underline transition-colors hover:text-foreground">#{tag}</a>
          {/each}
        </div>
      {/if}

      <div class="flex flex-wrap items-center gap-4 border-t border-border/40 pt-3">
        <button type="button" class="inline-flex min-h-8 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground" onclick={() => void copyLink()}>
          <Link2 size={14} /> {copied ? 'Copied' : 'Copy link'}
        </button>
        <button type="button" class="inline-flex min-h-8 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground" onclick={() => void download()}>
          <ImageDown size={14} /> Download
        </button>
        {#if data.replies.length}
          <button type="button" class="inline-flex min-h-8 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground" onclick={() => document.getElementById('replies')?.scrollIntoView({ behavior: 'smooth' })}>
            <MessageSquareQuote size={14} /> {data.replies.length} {data.replies.length === 1 ? 'reply' : 'replies'}
          </button>
        {/if}
      </div>
    </article>

    <section id="replies" class="mt-6 scroll-mt-4 space-y-4">
      {#if data.principal._tag === 'Anonymous'}
        <p class="text-base text-muted-foreground"><a href={`/auth/sign-in?redirect=${encodeURIComponent(`/tweet/${params.slug}`)}`} class="underline">Sign in</a> to reply</p>
      {:else if !replyOpen}
        <button type="button" class="min-h-9 rounded-sm border border-border px-3 text-sm font-medium transition-colors hover:bg-muted" onclick={() => (replyOpen = true)}>Reply</button>
      {:else}
        <form class="space-y-2 rounded-lg border border-border/60 bg-card/60 p-3" onsubmit={(event) => { event.preventDefault(); void postReply() }}>
          <label class="sr-only" for="reply">Write a reply</label>
          <textarea id="reply" bind:value={draft} class="h-20 w-full rounded-sm border border-border bg-background p-3 text-base" placeholder="Write a reply…"></textarea>
          <div class="flex items-center justify-end gap-2">
            <button type="button" class="min-h-9 px-3 text-sm text-muted-foreground" onclick={() => (replyOpen = false)}>Cancel</button>
            <button disabled={posting || !draft.trim()} class="min-h-9 bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{posting ? 'Posting…' : 'Post reply'}</button>
          </div>
        </form>
      {/if}
      {#if status}<p role="status" class="text-sm text-muted-foreground">{status}</p>{/if}

      <div>
        {#each data.replies as reply, index}
          {@const replyMusic = record(reply.music)}
          <div class="relative">
            {#if index < data.replies.length - 1}<div class="absolute left-[35px] top-full h-2 w-px bg-border/60" aria-hidden="true"></div>{/if}
            <article class="mb-2 space-y-3 rounded-lg border border-border/40 bg-card p-3 transition-colors hover:bg-card/80">
              <TweetAuthorRow creator={records(reply.creators)[0] ?? null} createdAt={text(reply.createdAt)} />
              <div class="prose prose-sm max-w-none text-foreground prose-p:my-0 prose-p:leading-relaxed dark:prose-invert"><RichContent content={text(reply.content)} /></div>
              {#if replyMusic}
                <TweetMusicCard type={text(reply.musicEntityType)} entity={record(replyMusic.entity)} links={records(replyMusic.links)} />
              {/if}
              <a href={`/tweet/${text(reply.slug)}`} class="inline-block text-xs text-muted-foreground no-underline hover:text-foreground">View reply</a>
            </article>
          </div>
        {/each}
      </div>
    </section>
  </div>
{/if}
