<script lang="ts">
  import PublicHead from '@/lib/components/public/PublicHead.svelte'
  import PublicState from '@/lib/components/public/PublicState.svelte'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()
</script>

<PublicHead
  title="Tags"
  description="Browse music, culture and community posts by tag."
  canonical="/tags"
/>
<section class="mx-auto max-w-2xl px-4 py-8">
  <h1 class="mb-6 text-3xl font-black">Tags</h1>
  {#if data.failure}<PublicState
      message={data.failure}
      error
    />{:else if data.tags.length === 0}<PublicState message="No tags yet." />{:else}<div
      class="flex flex-wrap gap-4"
    >
      {#each data.tags as tag}<a
          href={`/tags/${encodeURIComponent(tag)}`}
          class="text-muted-foreground hover:text-highlight">#{tag}</a
        >{/each}
    </div>{/if}
</section>
