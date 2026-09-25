<script lang="ts">
  import { invalidateAll } from '$app/navigation'
  import ContentDetail from '@/lib/components/public/ContentDetail.svelte'
  import PublicHead from '@/lib/components/public/PublicHead.svelte'
  import PublicState from '@/lib/components/public/PublicState.svelte'
  import RichContent from '@/lib/components/public/RichContent.svelte'
  import { records, text } from '@/lib/public-content'
  import type { PageProps } from './$types'

  let { data, params }: PageProps = $props()
  let draft = $state('')
  let posting = $state(false)
  let status = $state('')
  const title = $derived(text(data.item?.title, text(data.item?.content, 'Tweet')).slice(0, 120))
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
    <ContentDetail item={data.item} kind="Tweet" canonical={`/tweet/${params.slug}`} />
    <button class="mb-8 border border-border px-3 py-2 text-sm font-bold" onclick={download}>Share / download image</button>
    <section id="replies" class="border-t border-border pt-6"><h2 class="text-xl font-black">Replies ({data.replies.length})</h2>
      <form class="my-4" onsubmit={(event) => { event.preventDefault(); void postReply() }}><label class="sr-only" for="reply">Write a reply</label><textarea id="reply" bind:value={draft} class="min-h-24 w-full border border-border bg-background p-3" placeholder="Write a reply…"></textarea><div class="mt-2 flex items-center gap-3"><button disabled={posting || !draft.trim()} class="bg-highlight px-4 py-2 font-bold text-highlight-foreground">{posting ? 'Posting…' : 'Post reply'}</button>{#if status}<span role="status" class="text-sm text-muted-foreground">{status}</span>{/if}</div></form>
      <div class="space-y-4">{#each data.replies as reply}<article class="border border-border p-4"><p class="mb-2 text-sm font-bold">{text(records(reply.creators)[0]?.name, 'Listener')} <time class="font-normal text-muted-foreground" datetime={text(reply.createdAt)}>{text(reply.createdAt) ? new Date(text(reply.createdAt)).toLocaleDateString() : ''}</time></p><RichContent content={text(reply.content)} /></article>{/each}</div>
    </section>
  </div>
{/if}
