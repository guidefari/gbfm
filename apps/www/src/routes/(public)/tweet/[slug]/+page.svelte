<script lang="ts">
  import type { MicroPostNeighboursResponse } from '@gbfm/api/navigation'

  import PublicHead from '@/lib/components/public/PublicHead.svelte'
  import ReadModeToggle from '@/lib/components/tweet/ReadModeToggle.svelte'
  import ReplyForm from '@/lib/components/tweet/ReplyForm.svelte'
  import ReplyList from '@/lib/components/tweet/ReplyList.svelte'
  import TimelineColumn from '@/lib/components/tweet/TimelineColumn.svelte'
  import TweetCard from '@/lib/components/tweet/TweetCard.svelte'
  import TweetNavigator from '@/lib/components/tweet/TweetNavigator.svelte'
  import TweetPreview from '@/lib/components/tweet/TweetPreview.svelte'
  import TweetShortcuts from '@/lib/components/tweet/TweetShortcuts.svelte'
  import TweetTimeline from '@/lib/components/tweet/TweetTimeline.svelte'
  import { tweetLinks } from '@/lib/components/tweet/tweet-links'

  import type { PageProps } from './$types'

  let { data, form }: PageProps = $props()

  let neighbours = $state<MicroPostNeighboursResponse | null>(null)

  const post = $derived(data.screen.post)

  const title = $derived((post.title?.trim() || post.content?.trim() || 'Tweet').slice(0, 120))

  const description = $derived(
    (post.description?.trim() || post.content?.trim() || 'A tweet on goosebumps.fm').slice(0, 160),
  )

  const slug = $derived(post.slug)

  const replyCount = $derived(data.replies.then((replies) => replies?.length ?? 0))

  const readMode = $derived(form?.readMode ?? data.readMode)

  const links = $derived(tweetLinks(neighbours, readMode))

  const hasUnread = $derived((neighbours?.unreadCount ?? 0) > 0)

  $effect(() => {
    const pending = data.neighbours
    neighbours = null
    void pending.then((resolved) => {
      if (data.neighbours === pending) neighbours = resolved
    })
  })

  $effect(() => {
    navigator.sendBeacon(`/api/content/posts/micro/${encodeURIComponent(slug)}/seen`)
  })
</script>

<PublicHead {title} {description} canonical={`/tweet/${slug}`} />

<TweetShortcuts newer={links.newer} older={links.older} randomMessage={form?.random} />

{#snippet readModeRow()}
  <div class="flex items-center justify-between gap-3 text-xs text-muted-foreground">
    <span>Browse</span>
    <ReadModeToggle {readMode} />
  </div>
{/snippet}

<div
  class="mx-auto max-w-6xl px-4 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-12"
>
  <div class="min-w-0">
    <div class="mb-6 space-y-3 lg:hidden">
      <TweetTimeline timeline={neighbours?.timeline ?? null} at={post.createdAt} />
      <TweetNavigator newer={links.newer} older={links.older} {hasUnread} />
      {@render readModeRow()}
    </div>

    {#if data.screen.root.slug !== post.slug}
      <div class="pb-4">
        <TweetPreview post={data.screen.root} variant="parent" />
        <div class="relative h-2">
          <div class="absolute left-5 top-0 h-2 w-px bg-border/60" aria-hidden="true"></div>
        </div>
      </div>
    {/if}

    <TweetCard
      {post}
      quote={data.screen.quote}
      {title}
      {replyCount}
      seen={neighbours?.seen ?? null}
    />

    <section id="replies" class="mt-6 scroll-mt-4 space-y-4">
      <ReplyForm {slug} signedIn={data.principal._tag !== 'Anonymous'} feedback={form?.reply} />
      {#await data.replies}
        <p class="py-4 text-sm text-muted-foreground" role="status">Loading replies…</p>
      {:then replies}
        {#if replies}
          <ReplyList {replies} />
        {:else}
          <p class="py-4 text-sm text-muted-foreground" role="status">
            Replies are unavailable right now.
          </p>
        {/if}
      {/await}
    </section>
  </div>

  <aside class="hidden lg:block" aria-label="Where you are">
    <div class="sticky top-6 max-h-[calc(100vh-7rem)] space-y-5 overflow-y-auto pb-4 pl-2">
      <TweetNavigator newer={links.newer} older={links.older} {hasUnread} />
      {@render readModeRow()}
      <TimelineColumn timeline={neighbours?.timeline ?? null} at={post.createdAt} />
    </div>
  </aside>
</div>
