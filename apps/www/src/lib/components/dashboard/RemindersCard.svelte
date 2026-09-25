<script lang="ts">
  import { GetMusicRemindersResponse } from '@gbfm/api/music-reminders'
  import { Bell, Plus } from 'lucide-svelte'
  import { onMount } from 'svelte'
  import { dashboardJson } from './api'

  type Reminder = typeof GetMusicRemindersResponse.Type.reminders[number]
  let reminders = $state<ReadonlyArray<Reminder>>([])
  let loading = $state(true)
  let error = $state('')
  const upcoming = $derived(reminders.filter((item) => !item.isSent).toSorted((a, b) => Date.parse(a.reminderDate) - Date.parse(b.reminderDate)))
  const recent = $derived(reminders.filter((item) => item.isSent).toSorted((a, b) => Date.parse(b.reminderDate) - Date.parse(a.reminderDate)))
  const sections = $derived([
    { label: 'Upcoming', reminders: upcoming.slice(0, 5) },
    { label: 'Recent', reminders: recent.slice(0, 4) }
  ])

  onMount(async () => {
    try { reminders = (await dashboardJson(GetMusicRemindersResponse, '/api/music-reminders')).reminders }
    catch { error = 'Could not load reminders.' }
    finally { loading = false }
  })
</script>

<section class="overflow-hidden rounded bg-card/15" aria-labelledby="reminders-heading">
  <header class="flex items-center justify-between bg-muted/20 p-5"><h2 id="reminders-heading" class="flex items-center gap-2 text-xs font-bold tracking-widest"><Bell class="size-3.5 text-primary" /> Reminders</h2><div class="flex gap-3 text-xs font-bold"><a class="flex items-center gap-1 no-underline" href="/reminders"><Plus class="size-3" /> New</a><a class="text-muted-foreground no-underline" href="/reminders">Manage</a></div></header>
  <div class="p-5">
    {#if loading}<div class="space-y-3" aria-label="Loading reminders">{#each Array(3) as _}<div class="h-14 animate-pulse bg-muted"></div>{/each}</div>
    {:else if error}<p class="text-sm text-destructive">{error}</p>
    {:else if reminders.length === 0}<div class="py-10 text-center"><p class="mb-4 text-sm text-muted-foreground">No reminders yet</p><a class="rounded border border-primary px-5 py-2 text-xs font-bold no-underline" href="/reminders">Create</a></div>
    {:else}
      {#each sections as section}
        {#if section.reminders.length}<div class="mb-7 space-y-2"><h3 class="text-xs font-bold tracking-widest text-muted-foreground">{section.label}</h3>{#each section.reminders as reminder}<a href={reminder.musicUrl} class="flex items-center gap-3 rounded p-2 no-underline hover:bg-muted/40"><span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded border bg-muted">{#if reminder.albumCoverUrl}<img class="size-full object-cover" src={reminder.albumCoverUrl} alt="" />{:else}<Bell class="size-5" />{/if}</span><span class="min-w-0 flex-1"><strong class="block truncate">{reminder.musicTitle}</strong><small class="block truncate text-muted-foreground">{reminder.artistName}</small></span><time class="text-xs text-muted-foreground" datetime={reminder.reminderDate}>{new Date(reminder.reminderDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></a>{/each}</div>{/if}
      {/each}
    {/if}
  </div>
</section>
