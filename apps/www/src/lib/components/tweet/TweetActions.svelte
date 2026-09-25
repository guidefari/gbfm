<script lang="ts">
  import { ImageDown, Link2, MessageSquareQuote } from 'lucide-svelte'
  import { shareTweetImage } from './share-image'

  let {
    slug,
    title,
    content,
    replyCount,
  }: { slug: string; title: string; content: string; replyCount: number } = $props()

  let copied = $state(false)

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    copied = true
    setTimeout(() => (copied = false), 1800)
  }
</script>

<div class="flex flex-wrap items-center gap-4 border-t border-border/40 pt-3">
  <button
    type="button"
    class="inline-flex min-h-8 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    onclick={() => void copyLink()}
  >
    <Link2 size={14} />
    {copied ? 'Copied' : 'Copy link'}
  </button>
  <button
    type="button"
    class="inline-flex min-h-8 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    onclick={() => void shareTweetImage(slug, title, content)}
  >
    <ImageDown size={14} /> Download
  </button>
  {#if replyCount}
    <a
      href="#replies"
      class="inline-flex min-h-8 items-center gap-1.5 text-xs text-muted-foreground no-underline transition-colors hover:text-foreground"
    >
      <MessageSquareQuote size={14} />
      {replyCount}
      {replyCount === 1 ? 'reply' : 'replies'}
    </a>
  {/if}
</div>
