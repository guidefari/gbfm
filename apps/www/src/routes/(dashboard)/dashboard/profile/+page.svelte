<script lang="ts">
  import type { PageProps } from './$types'
  import Page from '@/lib/components/dashboard/Page.svelte'
  import ProfileSettings from '@/lib/components/dashboard/settings/ProfileSettings.svelte'

  let { data }: PageProps = $props()
</script>

<Page title="Account Profile" description="Manage your account details and password."
  ><ProfileSettings initialProfile={data.profile} initialError={data.failure} /></Page
>
