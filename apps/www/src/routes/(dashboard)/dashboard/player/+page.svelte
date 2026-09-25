<script lang="ts">
  import { Schema } from 'effect'
  import { onMount } from 'svelte'
  import Page from '@/lib/components/dashboard/Page.svelte'
  import { dashboardCommand, dashboardJson } from '@/lib/components/dashboard/api'
  import { defaultPlayerPreferences, readPlayerPreferences, savePlayerPreferences, type PlayerPreferences } from '@/lib/player/player'

  const Reminder = Schema.Struct({ id: Schema.String, userId: Schema.String, musicTitle: Schema.String, artistName: Schema.String, musicUrl: Schema.String, albumCoverUrl: Schema.NullOr(Schema.String), reminderDate: Schema.String, notes: Schema.NullOr(Schema.String), status: Schema.String, isSent: Schema.Boolean, createdAt: Schema.String, updatedAt: Schema.String })
  const Response = Schema.Struct({ success: Schema.Boolean, reminders: Schema.Array(Reminder), total: Schema.Number })
  let reminders = $state<ReadonlyArray<typeof Reminder.Type>>([])
  let preferences = $state<PlayerPreferences>({ ...defaultPlayerPreferences })
  let message = $state('')

  async function load() {
    preferences = { ...readPlayerPreferences() }
    try { reminders = (await dashboardJson(Response, '/api/music-reminders')).reminders }
    catch { message = 'Could not load reminders.' }
  }
  function save() { savePlayerPreferences(preferences); message = 'Player preferences saved.' }
  async function remove(id: string) { if (!confirm('Delete this reminder?')) return; try { await dashboardCommand(`/api/music-reminders/${id}`, { method: 'DELETE' }); await load() } catch { message = 'Could not delete reminder.' } }
  onMount(load)
</script>

<Page title="Player Settings" description="Control queue behavior and music reminders on this device.">
  <form class="grid max-w-2xl gap-4 rounded border p-5" onsubmit={(event) => { event.preventDefault(); save() }}>
    <label class="flex justify-between gap-4"><span><strong>Continue through queue</strong><small class="block text-muted-foreground">Automatically play the next queued track.</small></span><input type="checkbox" bind:checked={preferences.continueQueue} /></label>
    <label class="flex justify-between gap-4"><span><strong>Restore listening position</strong><small class="block text-muted-foreground">Resume each track from its last saved position.</small></span><input type="checkbox" bind:checked={preferences.restorePosition} /></label>
    <button class="w-fit rounded bg-foreground px-4 py-2 text-background">Save player settings</button>
  </form>
  <section class="max-w-2xl rounded border p-5"><h2 class="mb-3 font-bold">Music reminders</h2>{#each reminders as reminder}<div class="flex justify-between gap-4 border-t py-3"><div><strong>{reminder.musicTitle}</strong><span class="block text-sm text-muted-foreground">{reminder.artistName} · {new Date(reminder.reminderDate).toLocaleString()} · {reminder.status}</span></div><button class="text-destructive underline" onclick={() => void remove(reminder.id)}>Delete</button></div>{/each}{#if reminders.length === 0}<p class="text-muted-foreground">No reminders.</p>{/if}</section>
  {#if message}<p aria-live="polite">{message}</p>{/if}
</Page>
