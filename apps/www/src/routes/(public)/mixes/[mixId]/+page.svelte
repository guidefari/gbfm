<script lang="ts">import DetailPage from '@/lib/components/public/DetailPage.svelte'; import type { PageProps } from './$types'; let { data }: PageProps = $props()</script>
<DetailPage {data} kind="Mix" canonical={`/mixes/${data.item?.slug ?? ''}`} fallbackTitle="Mix" />
