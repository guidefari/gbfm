<script lang="ts">
  import ContentDetail from './ContentDetail.svelte'
  import PublicHead from './PublicHead.svelte'
  import PublicState from './PublicState.svelte'
  import { text, type PublicRecord } from '@/lib/public-content'

  let {
    data,
    kind,
    canonical,
    fallbackTitle,
    relatedShow = null,
  }: {
    data: { item: PublicRecord | null; failure: string | null; actionActive?: boolean }
    kind: string
    canonical: string
    fallbackTitle: string
    relatedShow?: PublicRecord | null
  } = $props()

  const string = (item: PublicRecord | null, key: string, fallback = '') =>
    text(item?.[key], fallback)
</script>

<PublicHead
  title={string(data.item, 'title', string(data.item, 'name', fallbackTitle))}
  description={string(
    data.item,
    'description',
    `Listen to and discover ${fallbackTitle} on goosebumps.fm.`,
  )}
  {canonical}
  {...string(data.item, 'thumbnailUrl', string(data.item, 'imageUrl'))
    ? { image: string(data.item, 'thumbnailUrl', string(data.item, 'imageUrl')) }
    : {}}
/>
{#if data.failure || !data.item}
  <PublicState message={data.failure ?? 'This page could not be found.'} error />
{:else}
  <ContentDetail
    item={data.item}
    {kind}
    {canonical}
    {relatedShow}
    {...data.actionActive === undefined ? {} : { actionActive: data.actionActive }}
  />
{/if}
