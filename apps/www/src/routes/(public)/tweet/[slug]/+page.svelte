<script lang="ts">
  import PublicHead from '@/lib/components/public/PublicHead.svelte'
  import ReplyForm from '@/lib/components/tweet/ReplyForm.svelte'
  import ReplyList from '@/lib/components/tweet/ReplyList.svelte'
  import TweetCard from '@/lib/components/tweet/TweetCard.svelte'
  import TweetPager from '@/lib/components/tweet/TweetPager.svelte'
  import TweetPreview from '@/lib/components/tweet/TweetPreview.svelte'
  import TweetProgress from '@/lib/components/tweet/TweetProgress.svelte'
  import type { PageProps } from './$types'

  let { data, form }: PageProps = $props()

  const post = $derived(data.screen.post)

  const title = $derived((post.title?.trim() || post.content?.trim() || 'Tweet').slice(0, 120))

  const description = $derived(
    (post.description?.trim() || post.content?.trim() || 'A tweet on goosebumps.fm').slice(0, 160),
  )

  const slug = $derived(post.slug)

  $effect(() => {
    navigator.sendBeacon(`/api/content/posts/micro/${encodeURIComponent(slug)}/seen`)
  })
</script>

<PublicHead {title} {description} canonical={`/tweet/${slug}`} />

<div class="mx-auto max-w-3xl px-4 py-8">
  {#await data.neighbours}
    <TweetPager neighbours={null} randomMessage={undefined} />
    <TweetProgress neighbours={null} />
  {:then neighbours}
    <TweetPager {neighbours} randomMessage={form?.random} />
    <TweetProgress {neighbours} />
  {/await}

  {#if data.screen.root.slug !== post.slug}
    <div class="pb-4">
      <TweetPreview post={data.screen.root} variant="parent" />
      <div class="relative h-2">
        <div class="absolute left-5 top-0 h-2 w-px bg-border/60" aria-hidden="true"></div>
      </div>
    </div>
  {/if}

  <TweetCard {post} quote={data.screen.quote} {title} replyCount={data.screen.replies.length} />

  <section id="replies" class="mt-6 scroll-mt-4 space-y-4">
    <ReplyForm {slug} signedIn={data.principal._tag !== 'Anonymous'} feedback={form?.reply} />
    <ReplyList replies={data.screen.replies} />
  </section>
</div>
