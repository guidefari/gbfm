<script lang="ts">import type { PageProps } from './$types'; import MusicEntityEditor from '@/lib/components/dashboard/content-tools/MusicEntityEditor.svelte'; let { data }: PageProps = $props()</script>
<MusicEntityEditor entityType={data.entityType as 'artist' | 'album' | 'track' | 'playlist' | 'label'} id={data.id} />
