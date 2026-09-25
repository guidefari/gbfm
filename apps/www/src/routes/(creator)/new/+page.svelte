<script lang="ts">import Composer from '@/lib/components/creator/Composer.svelte'; import type { PageProps } from './$types';

 let {data}:PageProps=$props()</script><svelte:head><title>New content</title></svelte:head><Composer userId={data.principal._tag==='Authenticated'?data.principal.userId:''} />
