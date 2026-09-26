<script lang="ts">
  import type { MicroPostScreenPost } from '@gbfm/api/post'
  import RichContent from '@/lib/components/public/RichContent.svelte'
  import TweetAuthorRow from './TweetAuthorRow.svelte'
  import TweetMusicCard from './TweetMusicCard.svelte'

  let { replies }: { replies: ReadonlyArray<MicroPostScreenPost> } = $props()
</script>

<div>
  {#each replies as reply, index (reply.id)}
    <div class="relative">
      {#if index < replies.length - 1}<div
          class="absolute left-[35px] top-full h-2 w-px bg-border/60"
          aria-hidden="true"
        ></div>{/if}
      <article
        class="mb-2 space-y-3 rounded-lg border border-border/40 bg-card p-3 transition-colors hover:bg-card/80"
      >
        <TweetAuthorRow creator={reply.creators?.[0] ?? null} createdAt={reply.createdAt} />
        <div
          class="prose prose-sm max-w-none text-foreground prose-p:my-0 prose-p:leading-relaxed dark:prose-invert"
        >
          <RichContent content={reply.content ?? ''} />
        </div>
        {#if reply.music}<TweetMusicCard music={reply.music} />{/if}
        <a
          href={`/tweet/${reply.slug}`}
          class="inline-block text-xs text-muted-foreground no-underline hover:text-foreground"
          >View reply</a
        >
      </article>
    </div>
  {/each}
</div>
