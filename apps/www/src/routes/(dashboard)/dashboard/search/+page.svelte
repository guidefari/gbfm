<script lang="ts">
  import Page from '@/lib/components/dashboard/Page.svelte'; import ApiTable from '@/lib/components/dashboard/ApiTable.svelte'
  let query = $state(''), submitted = $state('')
</script>
<Page title="Search" description="Search shows, audio, and posts."><form class="flex gap-2" onsubmit={(event) => { event.preventDefault(); submitted = query }}><input class="min-w-0 flex-1 rounded border bg-background px-3 py-2" bind:value={query} placeholder="Search…" /><button class="rounded bg-foreground px-4 text-background">Search</button></form>{#if submitted}<ApiTable endpoint={`/api/search?q=${encodeURIComponent(submitted)}`} />{/if}</Page>
