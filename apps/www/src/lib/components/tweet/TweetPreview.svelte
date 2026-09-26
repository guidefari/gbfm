<script lang="ts">
  import type { MicroPostScreenPost } from '@gbfm/api/post'
  import TweetAuthorRow from './TweetAuthorRow.svelte'
  import TweetMusicCard from './TweetMusicCard.svelte'

  let { post, variant }: { post: MicroPostScreenPost; variant: 'parent' | 'quote' } = $props()
</script>

<article
  class={variant === 'parent'
    ? 'space-y-3 overflow-hidden rounded-lg border border-border/40 bg-card p-3 opacity-80 transition-opacity hover:opacity-100'
    : 'not-prose space-y-3 overflow-hidden rounded-md border border-border/50 bg-muted/20 p-3 transition-colors hover:bg-muted/30'}
>
  <TweetAuthorRow
    creator={post.creators?.[0] ?? null}
    createdAt={post.createdAt}
    interactive={false}
  />
  <a href={`/tweet/${post.slug}`} class="block no-underline">
    <p class="mt-2 truncate text-base text-muted-foreground">{post.content || post.title}</p>
  </a>
  {#if post.music}<TweetMusicCard music={post.music} />{/if}
</article>
