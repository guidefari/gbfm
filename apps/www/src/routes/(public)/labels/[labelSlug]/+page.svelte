<script lang="ts">
  import DetailPage from '@/lib/components/public/DetailPage.svelte'
  import type { PageProps } from './$types'

  let { data, params }: PageProps = $props()
</script>

<DetailPage
  {data}
  kind="Record label"
  canonical={`/labels/${params.labelSlug}`}
  fallbackTitle="Record label"
/>
