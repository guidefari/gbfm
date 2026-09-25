<script lang="ts">import type { PageProps } from './$types'; import Page from '@/lib/components/dashboard/Page.svelte'; let { data }: PageProps = $props()</script>
<Page title={`Welcome back, ${data.principal._tag === 'Authenticated' ? data.principal.name.split(' ')[0] : 'there'}`} description="Here's what's happening">
  <div class="grid gap-4 sm:grid-cols-2"><a class="rounded border p-6 no-underline hover:bg-muted" href="/reminders"><b>Reminders</b><p class="mt-2 text-sm text-muted-foreground">Review your listening reminders.</p></a><a class="rounded border p-6 no-underline hover:bg-muted" href="/mixes"><b>Discover mixes</b><p class="mt-2 text-sm text-muted-foreground">Find something new to play.</p></a></div>
</Page>
