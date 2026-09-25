<script lang="ts">
  import { onMount } from 'svelte'
  import { getPlayerContext } from '@/lib/player/context'
  import {
    defaultPlayerPreferences,
    readPlayerPreferences,
    type PlayerPreferences,
  } from '@/lib/player/player'

  const player = getPlayerContext()

  let preferences = $state<PlayerPreferences>({ ...defaultPlayerPreferences })

  let saved = $state(false)

  onMount(() => {
    preferences = { ...readPlayerPreferences() }
  })

  function save() {
    player.updatePreferences(preferences)
    saved = true
  }
</script>

<div class="space-y-8">
  <div class="space-y-1">
    <h2 class="text-base font-bold tracking-widest text-muted-foreground">Player</h2>
    <p class="text-xs font-medium leading-relaxed tracking-wider text-muted-foreground">
      Playback opens fullscreen. Collapse it anytime to keep listening from the dock, or press F to
      toggle.
    </p>
  </div>
  <form
    class="max-w-2xl space-y-6 border-2 border-border p-6"
    onsubmit={(event) => {
      event.preventDefault()
      save()
    }}
  >
    <label class="flex items-start justify-between gap-6">
      <span
        ><strong class="text-base">Continue through queue</strong><small
          class="mt-1 block text-sm text-muted-foreground"
          >Automatically play the next queued track.</small
        ></span
      >
      <input
        class="mt-1 h-4 w-4 accent-primary"
        type="checkbox"
        bind:checked={preferences.continueQueue}
        onchange={() => (saved = false)}
      />
    </label>
    <label class="flex items-start justify-between gap-6">
      <span
        ><strong class="text-base">Restore listening position</strong><small
          class="mt-1 block text-sm text-muted-foreground"
          >Resume each track from its last saved position.</small
        ></span
      >
      <input
        class="mt-1 h-4 w-4 accent-primary"
        type="checkbox"
        bind:checked={preferences.restorePosition}
        onchange={() => (saved = false)}
      />
    </label>
    <div class="flex items-center gap-4">
      <button class="bg-foreground px-4 py-2 font-bold text-background" type="submit"
        >Save player settings</button
      >{#if saved}<span class="text-sm text-muted-foreground" role="status"
          >Player preferences saved.</span
        >{/if}
    </div>
  </form>
</div>
