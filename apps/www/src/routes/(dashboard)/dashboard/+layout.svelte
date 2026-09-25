<script lang="ts">
  import type { LayoutProps } from './$types'
  import DashboardShell from '@/lib/components/dashboard/DashboardShell.svelte'

  let { data, children }: LayoutProps = $props()
</script>
<DashboardShell principal={data.principal}>{@render children()}</DashboardShell>
