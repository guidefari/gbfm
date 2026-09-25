<script lang="ts">
  import type { PageProps } from './$types'
  import Page from '@/lib/components/dashboard/Page.svelte'
  import EmailPreferences from '@/lib/components/dashboard/settings/EmailPreferences.svelte'

  let { data }: PageProps = $props()
</script>

<Page title="Email Notifications" description="Choose which emails you want to receive."><EmailPreferences initialPreferences={data.preferences} initialError={data.failure} /></Page>
