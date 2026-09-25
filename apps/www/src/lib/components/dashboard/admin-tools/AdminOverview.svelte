<script lang="ts">
  import { AdminOverviewResponse } from '@gbfm/api/admin'
  import { onMount } from 'svelte'
  import { dashboardJson } from '../api'

  let { compact = false }: { compact?: boolean } = $props()
  type Overview = typeof AdminOverviewResponse.Type
  let overview = $state<Overview>()
  let error = $state('')

  const count = (value: number) => new Intl.NumberFormat('en-US').format(value)
  const date = (value: string) => new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const breakdowns = (value: Overview) => [
    ['Mixes', value.publishing.mixes], ['Tracks', value.publishing.tracks], ['Shows', value.publishing.shows],
    ['Posts', value.publishing.posts], ['Micros', value.publishing.micros], ['Labels', value.publishing.labels],
    ['Releases', value.publishing.releases], ['Misc audio', value.publishing.miscAudio]
  ] as const

  onMount(async () => {
    try { overview = await dashboardJson(AdminOverviewResponse, '/api/admin/overview') }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Failed to load admin overview.' }
  })
</script>

{#if error}<div class="rounded border border-destructive/50 p-6 text-center text-destructive">{error}</div>
{:else if !overview}<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{#each [1,2,3,4] as item}<div class="min-h-36 animate-pulse rounded border bg-muted/30" aria-label={`Loading metric ${item}`}></div>{/each}</div>
{:else}
  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {#each [
      ['Users', overview.highlights.totalUsers, `${count(overview.highlights.newUsersLast7Days)} new in 7 days`],
      ['Subscribers', overview.highlights.newsletterSubscribers, `${count(overview.highlights.newSubscribersLast30Days)} new in 30 days`],
      ['Published mixes', overview.highlights.publishedMixes, `${count(overview.highlights.newMixesLast30Days)} new in 30 days`],
      ['Total plays', overview.highlights.totalPlayCount, `${count(overview.community.sessions.active)} active sessions`]
    ] as metric}
      <article class="rounded border p-5"><h2 class="font-medium text-muted-foreground">{metric[0]}</h2><div class="mt-2 text-3xl font-black tracking-tight">{count(Number(metric[1]))}</div><p class="mt-2 text-sm text-muted-foreground">{metric[2]}</p></article>
    {/each}
  </div>
  {#if !compact}
    <div class="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
      <section class="rounded border p-5"><h2 class="mb-4 text-xl font-bold">Publishing pulse</h2><div class="grid gap-3 md:grid-cols-2">{#each breakdowns(overview) as [title, stats]}<article class="rounded border p-4"><h3 class="font-semibold">{title}</h3><dl class="mt-3 grid grid-cols-3 gap-2 text-sm"><div><dt class="text-muted-foreground">Published</dt><dd class="text-lg font-bold">{count(stats.published)}</dd></div><div><dt class="text-muted-foreground">Drafts</dt><dd class="text-lg font-bold">{count(stats.drafts)}</dd></div><div><dt class="text-muted-foreground">New 7d</dt><dd class="text-lg font-bold">{count(stats.newLast7Days)}</dd></div></dl></article>{/each}</div></section>
      <div class="space-y-4">
        <section class="rounded border p-5"><h2 class="mb-4 text-xl font-bold">Community snapshot</h2><dl class="space-y-3 text-sm">{#each [['Verified users',overview.community.users.verified],['Active sessions',overview.community.sessions.active],['Favorites',overview.community.engagement.favoritesTotal],['Show subscriptions',overview.community.engagement.showSubscriptionsTotal]] as row}<div class="flex justify-between"><dt class="text-muted-foreground">{row[0]}</dt><dd class="font-semibold">{count(Number(row[1]))}</dd></div>{/each}<div class="flex justify-between"><dt class="text-muted-foreground">Admins / Editors / Creators</dt><dd class="font-semibold">{overview.community.users.admins} / {overview.community.users.editors} / {overview.community.users.creators}</dd></div></dl></section>
        <section class="rounded border p-5"><h2 class="mb-4 text-xl font-bold">Operational health</h2><dl class="space-y-3 text-sm"><div class="flex justify-between"><dt class="text-muted-foreground">Emails failed in 7d</dt><dd class="font-semibold">{count(overview.operations.emails.failedLast7Days)}</dd></div><div class="flex justify-between"><dt class="text-muted-foreground">Pending reminders</dt><dd class="font-semibold">{count(overview.operations.reminders.pending)}</dd></div><div class="flex justify-between"><dt class="text-muted-foreground">Due now</dt><dd class="font-semibold">{count(overview.operations.reminders.dueNow)}</dd></div><div class="flex justify-between"><dt class="text-muted-foreground">Generated</dt><dd class="font-semibold">{date(overview.generatedAt)}</dd></div></dl></section>
      </div>
    </div>
    <div class="grid gap-4 xl:grid-cols-3">
      <section class="rounded border p-5"><h2 class="mb-4 text-xl font-bold">Recent content</h2><div class="space-y-4">{#each overview.publishing.recentContent as item}<div class="flex justify-between gap-4"><div><div class="font-medium">{item.title ?? item.slug}</div><div class="text-xs uppercase text-muted-foreground">{item.type} · {item.draft?'draft':'published'}</div></div><time class="text-xs text-muted-foreground">{date(item.createdAt)}</time></div>{/each}</div></section>
      <section class="rounded border p-5"><h2 class="mb-4 text-xl font-bold">Top mixes</h2><div class="space-y-4">{#each overview.publishing.topMixes as mix}<div class="flex justify-between gap-4"><div><div class="font-medium">{mix.title}</div><div class="text-xs text-muted-foreground">{mix.creators.join(', ') || 'No creator assigned'}</div></div><div class="font-semibold">{count(mix.playCount)} plays</div></div>{/each}</div></section>
      <section class="rounded border p-5"><h2 class="mb-4 text-xl font-bold">Recent email failures</h2>{#if overview.operations.emails.recentFailures.length===0}<p class="text-muted-foreground">No recent failures.</p>{:else}<div class="space-y-4">{#each overview.operations.emails.recentFailures as item}<div><div class="truncate font-medium">{item.subject}</div><div class="text-xs text-muted-foreground">{item.recipientEmail} · {item.status} · {date(item.createdAt)}</div>{#if item.errorMessage}<p class="mt-1 line-clamp-2 text-xs text-destructive">{item.errorMessage}</p>{/if}</div>{/each}</div>{/if}</section>
    </div>
  {/if}
{/if}
