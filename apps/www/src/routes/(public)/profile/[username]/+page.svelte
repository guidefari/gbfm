<script lang="ts">import ProfilePage from '@/lib/components/public/ProfilePage.svelte'; import type { PageProps } from './$types';

 let { data, params }: PageProps = $props()</script>
<ProfilePage item={data.item} failure={data.failure} canonical={`/profile/${params.username}`} />
