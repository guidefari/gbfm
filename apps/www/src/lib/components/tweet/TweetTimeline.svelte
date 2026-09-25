<script lang="ts">
  import type { MicroPostTimelineMonth } from '@gbfm/api/navigation'

  import { markerPercent, monthLabel, relativeAge, timelineMonths } from './timeline'

  let { timeline, at }: { timeline: ReadonlyArray<MicroPostTimelineMonth> | null; at: string } =
    $props()

  const months = $derived(timelineMonths(timeline ?? []))

  const busiest = $derived(Math.max(1, ...months.map((entry) => entry.total)))

  const marker = $derived(markerPercent(months, at))

  const age = $derived(relativeAge(at, Date.now()))

  const newest = $derived(months[0] ? monthLabel(months[0].month) : '')

  const oldest = $derived(months.at(-1) ? monthLabel(months.at(-1)?.month ?? '') : '')

  const barHeight = (entry: MicroPostTimelineMonth) =>
    entry.total ? Math.max(entry.total / busiest, 0.12) * 100 : 0
</script>

<figure class="mb-6" aria-busy={!timeline}>
  <div
    role="img"
    aria-label={months.length
      ? `Timeline from ${oldest} to ${newest}. This tweet is from ${age}.`
      : 'Timeline loading'}
    class="relative flex h-8 items-end gap-px"
  >
    {#each months as entry (entry.month)}
      <div
        class="flex flex-1 flex-col justify-end"
        style:height="{barHeight(entry)}%"
        title={monthLabel(entry.month)}
      >
        <div class="bg-primary/70" style:flex-grow={entry.unread}></div>
        <div class="bg-muted-foreground/30" style:flex-grow={entry.total - entry.unread}></div>
      </div>
    {/each}
    {#if months.length}
      <div
        class="pointer-events-none absolute -inset-y-1 w-px bg-foreground"
        style:left="{marker}%"
        aria-hidden="true"
      ></div>
    {/if}
  </div>
  <figcaption class="mt-1.5 flex justify-between gap-2 font-mono text-xs text-muted-foreground">
    {#if months.length}
      <span>{newest}</span>
      <span class="text-foreground">{age}</span>
      <span>{oldest}</span>
    {:else}
      <span>&nbsp;</span>
    {/if}
  </figcaption>
</figure>
