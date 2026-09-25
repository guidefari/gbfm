<script lang="ts">
  import ListPage from '@/lib/components/public/ListPage.svelte'
  import type { PublicRecord } from '@/lib/server/public/content'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  const href = (item: PublicRecord) => `/labels/${item.slug}`
</script>

<ListPage
  {data}
  title="Record Labels"
  description="Discover independent record labels featured on goosebumps.fm."
  canonical="/labels"
  {href}
  empty="No labels found."
/>
