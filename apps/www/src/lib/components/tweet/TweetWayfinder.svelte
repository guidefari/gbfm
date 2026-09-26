<script lang="ts">
  import type { MicroPostTimelineMonth } from '@gbfm/api/navigation'

  import JumpMenu, { type JumpItem } from './JumpMenu.svelte'
  import TweetTimeline from './TweetTimeline.svelte'
  import { tweetHref } from './tweet-links'
  import { monthOf, monthShort, relativeAge, timelineMonths, yearJumps } from './timeline'

  let {
    timeline,
    at,
    unreadCount,
  }: {
    timeline: ReadonlyArray<MicroPostTimelineMonth> | null
    at: string
    unreadCount: number | null
  } = $props()

  const months = $derived(timelineMonths(timeline ?? []))

  const currentMonth = $derived(monthOf(at))

  const currentYear = $derived(currentMonth.slice(0, 4))

  const here = $derived(relativeAge(at, Date.now()))

  const yearItems = $derived(
    yearJumps(months).map((entry): JumpItem => ({
      key: entry.year,
      label: entry.year,
      href: tweetHref(entry.newestSlug),
      current: entry.year === currentYear,
      total: entry.total,
      unread: entry.unread,
    })),
  )

  const monthItems = $derived(
    months
      .filter((entry) => entry.month.startsWith(currentYear))
      .map((entry): JumpItem => ({
        key: entry.month,
        label: monthShort(entry.month),
        href: tweetHref(entry.newestSlug),
        current: entry.month === currentMonth,
        total: entry.total,
        unread: entry.unread,
      })),
  )
</script>

<div
  class="sticky top-0 z-30 -mx-4 mb-6 space-y-1.5 border-b border-border bg-background/95 px-4 pb-2 pt-2 backdrop-blur"
>
  <div class="flex min-w-0 items-center gap-1 font-mono text-xs">
    <nav aria-label="Breadcrumb" class="flex min-w-0 items-center gap-0.5">
      <a
        href="/tweets"
        class="rounded-sm px-1.5 py-1 text-muted-foreground no-underline transition-colors hover:text-foreground"
        >Tweets</a
      >
      <span class="text-muted-foreground/50" aria-hidden="true">/</span>
      <JumpMenu id="tweet-year-menu" label={currentYear} title="Jump to year" items={yearItems} />
      <span class="text-muted-foreground/50" aria-hidden="true">/</span>
      <JumpMenu
        id="tweet-month-menu"
        label={monthShort(currentMonth)}
        title={`Jump within ${currentYear}`}
        items={monthItems}
      />
    </nav>
    <span class="ml-auto flex shrink-0 items-center gap-2 text-muted-foreground">
      <span>{here}</span>
      {#if unreadCount}<span class="text-highlight">{unreadCount} new</span>{/if}
    </span>
  </div>
  <TweetTimeline {timeline} {at} />
</div>
