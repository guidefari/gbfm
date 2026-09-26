<script lang="ts">
  import { enhance } from '$app/forms'

  import type { ReadMode } from './read-mode'

  let { readMode }: { readMode: ReadMode } = $props()

  let pending = $state<ReadMode | null>(null)

  const skipping = $derived((pending ?? readMode) === 'unread')
</script>

<form
  method="POST"
  action="?/readMode"
  use:enhance={() => {
    pending = skipping ? 'all' : 'unread'

    return async ({ update }) => {
      await update({ invalidateAll: false, reset: false })
      pending = null
    }
  }}
>
  <input type="hidden" name="mode" value={skipping ? 'all' : 'unread'} />
  <button
    role="switch"
    aria-checked={skipping}
    class="group flex w-full items-center justify-between gap-3 rounded-sm py-1 text-left text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <span>
      <span class="block text-foreground">Skip tweets you've seen</span>
      <span class="block">Newer and Older jump to unread only</span>
    </span>
    <span
      class="relative h-4 w-7 shrink-0 rounded-sm border border-border bg-muted transition-colors group-aria-checked:border-highlight group-aria-checked:bg-highlight"
      aria-hidden="true"
    >
      <span
        class="absolute left-0.5 top-0.5 size-2.5 rounded-[2px] bg-muted-foreground transition-transform group-aria-checked:translate-x-3 group-aria-checked:bg-highlight-foreground"
      ></span>
    </span>
  </button>
</form>
