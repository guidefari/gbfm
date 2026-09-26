<script lang="ts">
  import { GetMusicRemindersResponse } from '@gbfm/api/music-reminders'
  import { Option, Schema } from 'effect'

  const EnrichedTrack = Schema.Struct({
    title: Schema.String,
    artist: Schema.String,
    thumbnailUrl: Schema.optional(Schema.NullOr(Schema.String)),
    album: Schema.optional(Schema.NullOr(Schema.String)),
    platform: Schema.String,
  })

  type Reminder = (typeof GetMusicRemindersResponse.Type.reminders)[number]

  let {
    initialReminders,
    initialError = null,
  }: { initialReminders: ReadonlyArray<Reminder>; initialError?: string | null } = $props()

  let reminders = $derived(initialReminders),
    loading = $state(false),
    pending = $state(false),
    enriching = $state(false),
    error = $derived(initialError ?? ''),
    success = $state('')

  let musicUrl = $state(''),
    musicTitle = $state(''),
    artistName = $state(''),
    albumCoverUrl = $state(''),
    reminderDate = $state(''),
    notes = $state('')

  let enrichment = $state<typeof EnrichedTrack.Type | null>(null),
    enrichmentSequence = 0

  async function load() {
    loading = true

    try {
      const response = await fetch('/api/music-reminders')

      if (!response.ok) throw new Error()
      reminders = Schema.decodeUnknownSync(GetMusicRemindersResponse)(
        await response.json(),
      ).reminders
    } catch {
      error = 'Could not load reminders.'
    } finally {
      loading = false
    }
  }

  async function enrich() {
    const sequence = ++enrichmentSequence
    enrichment = null

    if (!musicUrl.trim()) return
    enriching = true

    try {
      const response = await fetch('/api/spotify/enrich', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: musicUrl.trim() }),
      })

      const parsed = Option.getOrNull(
        Schema.decodeUnknownOption(EnrichedTrack)(await response.json()),
      )

      if (sequence !== enrichmentSequence || !response.ok || !parsed) return
      enrichment = parsed

      if (!musicTitle) musicTitle = parsed.title

      if (!artistName) artistName = parsed.artist
      albumCoverUrl = parsed.thumbnailUrl ?? albumCoverUrl
    } catch {
      /* Manual entry remains available. */
    } finally {
      if (sequence === enrichmentSequence) enriching = false
    }
  }

  async function create() {
    error = ''
    success = ''
    const date = new Date(reminderDate)

    if (
      !musicTitle.trim() ||
      !artistName.trim() ||
      !musicUrl.trim() ||
      Number.isNaN(date.getTime())
    ) {
      error = 'Please fill in all required fields.'

      return
    }

    pending = true

    const payload = {
      musicTitle: musicTitle.trim(),
      artistName: artistName.trim(),
      musicUrl: musicUrl.trim(),
      albumCoverUrl: albumCoverUrl || undefined,
      reminderDate: date.toISOString(),
      notes: notes.trim() || undefined,
    }

    try {
      const response = await fetch('/api/music-reminders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error()
      musicUrl = ''
      musicTitle = ''
      artistName = ''
      albumCoverUrl = ''
      reminderDate = ''
      notes = ''
      enrichment = null
      success = 'Reminder created. We will email you when the time comes.'
      await load()
    } catch {
      error = 'Could not create reminder. Please try again.'
    } finally {
      pending = false
    }
  }

  async function remove(reminder: Reminder) {
    if (!confirm(`Delete reminder for “${reminder.musicTitle}”? This cannot be undone.`)) return
    const response = await fetch(`/api/music-reminders/${reminder.id}`, { method: 'DELETE' })

    if (!response.ok) {
      error = 'Could not delete reminder.'

      return
    }

    reminders = reminders.filter(({ id }) => id !== reminder.id)
    success = 'Reminder deleted.'
  }
</script>

<section class="mx-auto max-w-4xl px-4 py-12">
  <h1 class="text-4xl font-black">Music reminders</h1>
  <p class="mt-3 text-muted-foreground">
    Save music for later and we’ll email you when it is time to listen.
  </p>
  {#if error}<p role="alert" class="mt-5 border border-destructive p-3 text-destructive">
      {error}
    </p>{/if}{#if success}<p role="status" class="mt-5 border border-highlight p-3">
      {success}
    </p>{/if}
  <form
    class="mt-8 grid gap-4 border p-5 md:grid-cols-2"
    onsubmit={(event) => {
      event.preventDefault()
      void create()
    }}
  >
    <label class="grid gap-1 md:col-span-2"
      >Music URL (Spotify, YouTube, etc.)<input
        class="border bg-background p-3"
        bind:value={musicUrl}
        onblur={() => void enrich()}
        type="url"
        placeholder="https://…"
        required
      /></label
    >
    {#if enriching}<p class="text-sm text-muted-foreground md:col-span-2">
        Loading track details…
      </p>{:else if enrichment}<div class="flex gap-3 bg-muted p-3 md:col-span-2">
        {#if enrichment.thumbnailUrl}<img
            class="h-14 w-14 object-cover"
            src={enrichment.thumbnailUrl}
            alt={`${enrichment.title} cover`}
          />{/if}
        <div>
          <strong>Found: {enrichment.title} by {enrichment.artist}</strong>{#if enrichment.album}<p
              class="text-sm"
            >
              Album: {enrichment.album}
            </p>{/if}
          <p class="text-xs text-muted-foreground">Platform: {enrichment.platform}</p>
        </div>
      </div>{/if}
    <label class="grid gap-1"
      >Music title<input class="border bg-background p-3" bind:value={musicTitle} required /></label
    ><label class="grid gap-1"
      >Artist<input class="border bg-background p-3" bind:value={artistName} required /></label
    >
    <label class="grid gap-1"
      >Reminder date<input
        class="border bg-background p-3"
        bind:value={reminderDate}
        type="datetime-local"
        required
      /></label
    ><label class="grid gap-1"
      >Notes (optional)<textarea
        class="min-h-24 border bg-background p-3"
        bind:value={notes}
        placeholder="A memory or reason for future you…"></textarea></label
    >
    <button
      class="bg-primary p-3 font-bold text-primary-foreground disabled:opacity-50 md:col-span-2"
      disabled={pending}>{pending ? 'Creating…' : 'Add reminder'}</button
    >
  </form>
  <h2 class="mt-10 text-2xl font-bold">Your reminders</h2>
  {#if loading}<p class="mt-5">Loading…</p>{:else if reminders.length === 0}<p
      class="mt-5 text-muted-foreground"
    >
      No reminders yet.
    </p>{:else}<ul class="mt-5 grid gap-3">
      {#each reminders.toSorted((a, b) => new Date(b.reminderDate).getTime() - new Date(a.reminderDate).getTime()) as reminder}<li
          class="flex items-center gap-4 border p-4"
        >
          {#if reminder.albumCoverUrl}<img
              class="h-12 w-12 object-cover"
              src={reminder.albumCoverUrl}
              alt={`${reminder.musicTitle} cover`}
            />{/if}
          <div class="min-w-0 flex-1">
            <a href={reminder.musicUrl} target="_blank" rel="noreferrer" class="font-bold"
              >{reminder.musicTitle}</a
            >
            <p class="text-sm">
              by {reminder.artistName} · {new Date(reminder.reminderDate).toLocaleString()}
            </p>
            {#if reminder.notes}<p class="text-sm text-muted-foreground">{reminder.notes}</p>{/if}
          </div>
          <span class="text-xs">{reminder.isSent ? 'Sent' : 'Pending'}</span><button
            class="text-destructive"
            aria-label={`Delete reminder for ${reminder.musicTitle}`}
            onclick={() => void remove(reminder)}>Delete</button
          >
        </li>{/each}
    </ul>{/if}
</section>
