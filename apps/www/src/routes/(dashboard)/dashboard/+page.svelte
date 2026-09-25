<script lang="ts">
  import type { PageProps } from './$types'
  import FavoritesSection from '@/lib/components/dashboard/FavoritesSection.svelte'
  import Page from '@/lib/components/dashboard/Page.svelte'
  import RemindersCard from '@/lib/components/dashboard/RemindersCard.svelte'

  let { data }: PageProps = $props()
</script>
<Page title={`Welcome back, ${data.principal._tag === 'Authenticated' ? data.principal.name.split(' ')[0] : 'there'}`} description="Here's what's happening">
  <div class="grid grid-cols-1 gap-8 sm:gap-12 lg:grid-cols-12"><div class="lg:col-span-8"><FavoritesSection favorites={data.favorites} error={data.favoritesFailure} /></div><div class="lg:col-span-4"><RemindersCard reminders={data.reminders} error={data.remindersFailure} /></div></div>
</Page>
