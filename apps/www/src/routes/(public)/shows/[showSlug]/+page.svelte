<script lang="ts">import ShowsBrowser from '@/lib/components/public/ShowsBrowser.svelte'; import type { PageProps } from './$types'; let { data }: PageProps = $props()</script>
<ShowsBrowser shows={data.shows} selected={data.item} episodes={data.episodes} failure={data.failure} actionActive={data.actionActive} />
