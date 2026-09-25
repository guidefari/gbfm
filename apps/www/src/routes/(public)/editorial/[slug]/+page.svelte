<script lang="ts">
  import DetailPage from '@/lib/components/public/DetailPage.svelte'
  import type { PageProps } from './$types'

  let { data, params }: PageProps = $props()
</script>

<DetailPage
  {data}
  kind="Editorial"
  canonical={`/editorial/${params.slug}`}
  fallbackTitle="Editorial"
/>
