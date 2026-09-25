<script lang="ts">
  import { enhance } from '$app/forms'

  import type { ReadMode } from './read-mode'

  let { readMode }: { readMode: ReadMode } = $props()

  const options = [
    { value: 'unread', label: 'Unread' },
    { value: 'all', label: 'Everything' },
  ] satisfies ReadonlyArray<{ value: ReadMode; label: string }>
</script>

<form
  method="POST"
  action="?/readMode"
  aria-label="Older goes to"
  class="inline-flex rounded-sm border border-border p-0.5 text-xs"
  use:enhance={() =>
    async ({ update }) => {
      await update({ invalidateAll: false, reset: false })
    }}
>
  {#each options as option (option.value)}
    <button
      name="mode"
      value={option.value}
      aria-pressed={readMode === option.value}
      class="min-h-7 rounded-sm px-2.5 text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
    >
      {option.label}
    </button>
  {/each}
</form>
