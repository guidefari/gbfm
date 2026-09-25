<script lang="ts">
  import { invalidateAll } from '$app/navigation'
  import PublicHead from '@/lib/components/public/PublicHead.svelte'
  import PublicState from '@/lib/components/public/PublicState.svelte'
  import RichContent from '@/lib/components/public/RichContent.svelte'
  import TweetNav from '@/lib/components/public/TweetNav.svelte'
  import { records, text } from '@/lib/public-content'
  import type { PageProps } from './$types'

  let { data, params }: PageProps = $props()
  let draft = $state('')
  let posting = $state(false)
  let status = $state('')
  const title = $derived(text(data.item?.title, text(data.item?.content, 'Tweet')).slice(0, 120))
  const author = $derived(records(data.item?.creators)[0])
  const postReply = async () => {
    if (!draft.trim() || posting) return
    posting = true
    const response = await fetch(`/api/content/posts/micro/${encodeURIComponent(params.slug)}/replies`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: draft.trim() }) }).catch(() => null)
    if (response?.ok) { draft = ''; status = 'Reply posted'; await invalidateAll() }
    else status = response?.status === 401 ? 'Sign in to reply' : 'Could not post reply'
    posting = false
  }
  const download = async () => {
    if (!data.item) return
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630
    const context = canvas.getContext('2d'); if (!context) return
    context.fillStyle = '#080d0b'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#f4f7f5'; context.font = 'bold 44px sans-serif'
    const words = text(data.item.content, title).split(/\s+/); let line = ''; let y = 120
    for (const word of words) { const next = `${line}${word} `; if (context.measureText(next).width > 1000) { context.fillText(line, 100, y); line = `${word} `; y += 62 } else line = next }
    context.fillText(line, 100, y); context.fillStyle = '#7ec8da'; context.font = 'bold 30px sans-serif'; context.fillText('goosebumps.fm', 100, 560)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png')); if (!blob) return
    const file = new File([blob], `${params.slug}.png`, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title }) }
    else { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = file.name; link.click(); URL.revokeObjectURL(link.href) }
  }
</script>

<PublicHead {title} description={text(data.item?.description, text(data.item?.content, 'A tweet on goosebumps.fm')).slice(0, 160)} canonical={`/tweet/${params.slug}`} />
{#if data.failure || !data.item}<PublicState message={data.failure ?? 'This tweet could not be found.'} error />{:else}
  <div class="mx-auto max-w-3xl px-4 py-8">
    <div class="flex items-start justify-between"><TweetNav slug={params.slug} /><a href="/tweet/new" class="mt-2 text-sm font-bold text-highlight no-underline">Write a tweet</a></div>
    {#if data.parent && text(data.parent.slug) !== params.slug}<a href={`/tweet/${text(data.parent.slug)}`} class="mb-3 block border-l-2 border-highlight px-4 py-3 text-sm text-muted-foreground no-underline"><strong class="text-foreground">Part of a conversation</strong><span class="mt-1 line-clamp-2 block">{text(data.parent.content)}</span></a>{/if}
    <article class="space-y-4 border border-border/60 bg-card/60 p-4 shadow-sm sm:p-5">
      <header class="flex items-center gap-3">{#if text(author?.image, text(author?.imageUrl))}<img src={text(author?.image, text(author?.imageUrl))} alt="" class="h-10 w-10 object-cover" />{/if}<div class="min-w-0"><a href={text(author?.username) ? `/profile/${text(author?.username)}` : undefined} class="block truncate font-bold">{text(author?.name, 'goosebumps.fm')}</a><time class="text-xs text-muted-foreground" datetime={text(data.item.createdAt)}>{text(data.item.createdAt) ? new Date(text(data.item.createdAt)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</time></div></header>
      {#if text(data.item.title)}<h1 class="text-xl font-bold">{text(data.item.title)}</h1>{/if}<RichContent content={text(data.item.compiledContent, text(data.item.content))} />
      {#if text(data.item.musicEntityId)}<section class="border border-border bg-background p-4"><p class="text-[10px] font-bold uppercase tracking-widest text-highlight">{text(data.item.musicEntityType, 'Music')}</p><strong class="mt-1 block">Music attached to this tweet</strong><a href={`/tracks/${text(data.item.musicEntityId)}`} class="mt-2 inline-block text-sm">Open music ↗</a></section>{/if}
      {#if data.quote}<a href={`/tweet/${text(data.quote.slug)}`} class="block border border-border p-4 no-underline"><p class="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Quoted tweet</p><RichContent content={text(data.quote.content)} /></a>{/if}
      <footer class="flex flex-wrap gap-3 border-t border-border/40 pt-3">{#each Array.isArray(data.item.tags) ? data.item.tags : [] as tag}<a href={`/tags/${encodeURIComponent(String(tag))}`} class="text-sm text-highlight">#{String(tag)}</a>{/each}<button class="ml-auto text-sm font-bold" onclick={download}>Share / image</button></footer>
    </article>
    <section id="replies" class="border-t border-border pt-6"><h2 class="text-xl font-black">Replies ({data.replies.length})</h2>
      <form class="my-4" onsubmit={(event) => { event.preventDefault(); void postReply() }}><label class="sr-only" for="reply">Write a reply</label><textarea id="reply" bind:value={draft} class="min-h-24 w-full border border-border bg-background p-3" placeholder="Write a reply…"></textarea><div class="mt-2 flex items-center gap-3"><button disabled={posting || !draft.trim()} class="bg-highlight px-4 py-2 font-bold text-highlight-foreground">{posting ? 'Posting…' : 'Post reply'}</button>{#if status}<span role="status" class="text-sm text-muted-foreground">{status}</span>{/if}</div></form>
      <div class="space-y-4">{#each data.replies as reply}<article class="border border-border p-4"><p class="mb-2 text-sm font-bold">{text(records(reply.creators)[0]?.name, 'Listener')} <time class="font-normal text-muted-foreground" datetime={text(reply.createdAt)}>{text(reply.createdAt) ? new Date(text(reply.createdAt)).toLocaleDateString() : ''}</time></p><RichContent content={text(reply.content)} /></article>{/each}</div>
    </section>
  </div>
{/if}
