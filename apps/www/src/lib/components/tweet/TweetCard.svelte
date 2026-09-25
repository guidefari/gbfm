<script lang="ts">
  import type { MicroPostScreenPost } from '@gbfm/api/post'
  import RichContent from '@/lib/components/public/RichContent.svelte'
  import TweetActions from './TweetActions.svelte'
  import TweetAuthorRow from './TweetAuthorRow.svelte'
  import TweetMusicCard from './TweetMusicCard.svelte'
  import TweetPreview from './TweetPreview.svelte'

  let {
    post,
    quote,
    title,
    replyCount,
  }: {
    post: MicroPostScreenPost
    quote: MicroPostScreenPost | null
    title: string
    replyCount: number
  } = $props()
</script>

<article class="space-y-4 rounded-lg border border-border/60 bg-card/60 p-4 shadow-sm sm:p-5">
  <TweetAuthorRow creator={post.creators?.[0] ?? null} createdAt={post.createdAt} />

  {#if post.title}
    <h1 class="text-lg font-medium leading-snug tracking-tight">{post.title}</h1>
  {/if}

  <div
    class="prose prose-base max-w-none text-foreground prose-headings:font-black prose-headings:tracking-tighter prose-p:my-0 prose-p:leading-relaxed prose-a:text-foreground prose-a:underline dark:prose-invert"
  >
    <RichContent content={post.content ?? ''} />
  </div>

  {#if post.music}<TweetMusicCard music={post.music} />{/if}
  {#if quote}<TweetPreview post={quote} variant="quote" />{/if}

  {#if post.tags?.length}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
      {#each post.tags as tag}
        <a
          href={`/tags/${encodeURIComponent(tag)}`}
          class="text-xs font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
          >#{tag}</a
        >
      {/each}
    </div>
  {/if}

  <TweetActions slug={post.slug} {title} content={post.content || title} {replyCount} />
</article>
