<script lang="ts">import DetailPage from '@/lib/components/public/DetailPage.svelte'; import type { PageProps } from './$types';

 let { data, params }: PageProps = $props()</script>
<DetailPage {data} kind="Track" canonical={`/tracks/${params.trackId}`} fallbackTitle="Track" />
