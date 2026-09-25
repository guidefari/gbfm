<script lang="ts">
  import AdminOverview from '@/lib/components/dashboard/admin-tools/AdminOverview.svelte'
  import Page from '@/lib/components/dashboard/Page.svelte'
</script>

<Page
  title="Admin Dashboard"
  description="A route-first control center for publishing, operations, subscribers, and platform maintenance."
>
  <div class="flex flex-wrap gap-2">
    <a class="rounded border px-4 py-2 no-underline" href="/dashboard/overview">Full overview</a><a
      class="rounded border px-4 py-2 no-underline"
      href="/dashboard/music">Music catalog</a
    ><a class="rounded border px-4 py-2 no-underline" href="/dashboard/frontend-errors"
      >Frontend errors</a
    >
  </div>
  <AdminOverview compact />
  <section class="grid gap-4 rounded border p-5 md:grid-cols-3">
    <div>
      <h2 class="font-bold">User operations</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Manage accounts, roles, bans, and active sessions.
      </p>
    </div>
    <div>
      <h2 class="font-bold">Publishing flow</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Content, shows, newsletter, and file tools each have direct routes.
      </p>
    </div>
    <div>
      <h2 class="font-bold">Operational tooling</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Inspect delivery logs and frontend telemetry without leaving the workspace.
      </p>
    </div>
  </section>
</Page>
