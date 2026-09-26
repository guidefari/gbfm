<script lang="ts">
  import { goto } from '$app/navigation'
  import { navigating } from '$app/state'
  import { Match } from 'effect'

  let {
    newer,
    older,
    randomMessage,
  }: { newer: string | null; older: string | null; randomMessage: string | undefined } = $props()

  const loading = $derived(navigating.to?.route.id === '/(public)/tweet/[slug]')

  const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)

  const onkeydown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) return

    if (isTyping(event.target)) return

    const href = Match.value(event.key).pipe(
      Match.when('ArrowLeft', () => newer),
      Match.when('ArrowRight', () => older),
      Match.orElse(() => null),
    )

    if (!href) return
    event.preventDefault()
    void goto(href)
  }
</script>

<svelte:window {onkeydown} />

<div class="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
  {#if loading}
    <span role="status" class="bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
      Loading tweet…
    </span>
  {:else if randomMessage}
    <span role="alert" class="bg-card px-3 py-1 text-xs text-destructive shadow-sm">
      {randomMessage}
    </span>
  {/if}
</div>
