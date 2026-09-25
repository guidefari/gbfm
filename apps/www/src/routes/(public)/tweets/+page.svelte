<script lang="ts">
  import ListPage from '@/lib/components/public/ListPage.svelte'
  import type { PublicRecord } from '@/lib/public-content'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()
  const href = (item: PublicRecord) => `/tweet/${item.slug}`
</script>

<ListPage
  {data}
  title="Tweets"
  description="Short-form music notes and conversations from goosebumps.fm."
  canonical="/tweets"
  {href}
  empty="No tweets yet." />
