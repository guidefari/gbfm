<script lang="ts">
  import ListPage from '@/lib/components/public/ListPage.svelte'
  import type { PublicRecord } from '@/lib/server/public/content'
  import type { PageProps } from './$types'

  let { data, params }: PageProps = $props()

  const href = (item: PublicRecord) => `/tweet/${item.slug}`
</script>

<ListPage
  {data}
  title={`#${params.tag}`}
  description={`Posts tagged #${params.tag} on goosebumps.fm.`}
  canonical={`/tags/${params.tag}`}
  {href}
  empty="No posts with this tag yet."
/>
