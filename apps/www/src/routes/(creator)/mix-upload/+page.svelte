<script lang="ts">
  import MixUploader from '@/lib/components/creator/MixUploader.svelte'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()
</script>

<svelte:head><title>Upload a mix</title></svelte:head><MixUploader
  userId={data.principal._tag === 'Authenticated' ? data.principal.userId : ''}
/>
