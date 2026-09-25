<script lang="ts">import DetailPage from '@/lib/components/public/DetailPage.svelte'; import AudioList from '@/lib/components/public/AudioList.svelte'; import type { PageProps } from './$types'; let { data, params }: PageProps = $props()</script>
<DetailPage data={{ item: data.item, failure: data.failure }} kind="Radio show" canonical={`/shows/${params.showSlug}`} fallbackTitle="Radio show" />
{#if data.item}<section class="mx-auto max-w-3xl px-4 pb-12"><h2 class="mb-4 text-2xl font-black">Episodes</h2><AudioList items={data.episodes} /></section>{/if}
