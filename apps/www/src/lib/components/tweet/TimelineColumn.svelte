<script lang="ts">
  import type { MicroPostTimelineMonth } from '@gbfm/api/navigation'

  import { tweetHref } from './tweet-links'
  import {
    monthLabel,
    monthOf,
    type RailMonth,
    relativeAge,
    timelineMonths,
    yearGroups,
  } from './timeline'

  let { timeline, at }: { timeline: ReadonlyArray<MicroPostTimelineMonth> | null; at: string } =
    $props()

  const months = $derived(timelineMonths(timeline ?? []))

  const groups = $derived(yearGroups(months))

  const busiest = $derived(Math.max(1, ...months.map((entry) => entry.total)))

  const currentMonth = $derived(monthOf(at))

  const here = $derived(relativeAge(at, Date.now()))

  const width = (entry: RailMonth) =>
    entry.total ? Math.max(entry.total / busiest, 0.08) * 100 : 0
</script>

{#snippet bar(entry: RailMonth)}
  <span class="flex h-full" style:width="{width(entry)}%">
    <span class="h-full bg-primary/70" style:flex-grow={entry.unread}></span>
    <span class="h-full bg-muted-foreground/35" style:flex-grow={entry.total - entry.unread}></span>
  </span>
{/snippet}

<section aria-label="Timeline" aria-busy={!timeline} class="space-y-3">
  {#each groups as group (group.year)}
    <div>
      <p class="mb-1 font-mono text-xs text-muted-foreground">{group.year}</p>
      <ol class="space-y-px">
        {#each group.months as entry (entry.month)}
          {@const href = tweetHref(entry.newestSlug)}
          {@const isCurrent = entry.month === currentMonth}
          <li class="relative flex h-2 items-center">
            {#if href}
              <a
                {href}
                aria-label={`Jump to ${monthLabel(entry.month)}`}
                aria-current={isCurrent ? 'date' : undefined}
                title={monthLabel(entry.month)}
                class="flex h-full w-full opacity-80 transition-opacity hover:opacity-100"
              >
                {@render bar(entry)}
              </a>
            {:else}
              <span class="h-full w-full"></span>
            {/if}
            {#if isCurrent}
              <span
                class="pointer-events-none absolute -left-2 top-1/2 h-3 w-0.5 -translate-y-1/2 bg-foreground"
                aria-hidden="true"
              ></span>
            {/if}
          </li>
          {#if isCurrent}
            <li class="py-1 font-mono text-xs text-foreground">{here}</li>
          {/if}
        {/each}
      </ol>
    </div>
  {/each}
  {#if months.length}
    <p class="flex gap-3 pt-1 text-xs text-muted-foreground">
      <span class="inline-flex items-center gap-1.5">
        <span class="size-2 rounded-sm bg-primary/70"></span> New to you
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="size-2 rounded-sm bg-muted-foreground/35"></span> Seen
      </span>
    </p>
  {/if}
</section>
