<script lang="ts">
  import type { MicroPostTimelineMonth } from '@gbfm/api/navigation'

  import { tweetHref } from './tweet-links'
  import {
    markerPercent,
    monthLabel,
    type RailMonth,
    relativeAge,
    timelineMonths,
  } from './timeline'

  let { timeline, at }: { timeline: ReadonlyArray<MicroPostTimelineMonth> | null; at: string } =
    $props()

  const months = $derived(timelineMonths(timeline ?? []))

  const busiest = $derived(Math.max(1, ...months.map((entry) => entry.total)))

  const marker = $derived(markerPercent(months, at))

  const here = $derived(relativeAge(at, Date.now()))

  const labelShift = $derived(marker < 20 ? '0%' : marker > 80 ? '-100%' : '-50%')

  const barHeight = (entry: RailMonth) =>
    entry.total ? Math.max(entry.total / busiest, 0.12) * 100 : 0
</script>

<figure aria-busy={!timeline} class="space-y-1">
  <div class="relative flex h-8 items-end gap-px">
    {#each months as entry (entry.month)}
      {@const href = tweetHref(entry.newestSlug)}
      {#if href}
        <a
          {href}
          aria-label={`Jump to ${monthLabel(entry.month)}`}
          title={monthLabel(entry.month)}
          class="flex flex-1 flex-col justify-end opacity-80 hover:opacity-100"
          style:height="{barHeight(entry)}%"
        >
          <span class="bg-primary/70" style:flex-grow={entry.unread}></span>
          <span class="bg-muted-foreground/35" style:flex-grow={entry.total - entry.unread}></span>
        </a>
      {:else}
        <span class="flex-1"></span>
      {/if}
    {/each}
    {#if months.length}
      <span
        class="pointer-events-none absolute -inset-y-1 w-0.5 bg-foreground"
        style:left="{marker}%"
        aria-hidden="true"
      ></span>
    {/if}
  </div>
  <figcaption class="relative h-4 font-mono text-xs">
    {#if months.length}
      <span
        class="absolute whitespace-nowrap text-foreground"
        style:left="{marker}%"
        style:transform="translateX({labelShift})">{here}</span
      >
    {/if}
  </figcaption>
</figure>
