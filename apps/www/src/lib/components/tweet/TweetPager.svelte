<script lang="ts">
  import type { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
  import { enhance } from '$app/forms'
  import { goto } from '$app/navigation'
  import { navigating } from '$app/state'
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'
  import { Match } from 'effect'

  let {
    neighbours,
    randomMessage,
  }: { neighbours: MicroPostNeighboursResponse | null; randomMessage: string | undefined } =
    $props()

  let randomForm: HTMLFormElement | undefined = $state()

  let holdTimer: ReturnType<typeof setTimeout> | undefined

  let held = false

  const tweetHref = (slug: string | null | undefined) =>
    slug ? `/tweet/${encodeURIComponent(slug)}` : null

  const backHref = $derived(tweetHref(neighbours?.back))

  const forwardHref = $derived(tweetHref(neighbours?.forward))

  const forwardLabel = $derived(
    neighbours?.hasUnread ? 'Next tweet (hold for random)' : 'Next tweet',
  )

  const loading = $derived(navigating.to?.route.id === '/(public)/tweet/[slug]')

  const startHold = () => {
    held = false

    if (!neighbours?.hasUnread) return
    holdTimer = setTimeout(() => {
      held = true
      randomForm?.requestSubmit()
    }, 900)
  }

  const endHold = () => clearTimeout(holdTimer)

  const skipClickAfterHold = (event: MouseEvent) => {
    if (!held) return
    event.preventDefault()
    held = false
  }

  const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)

  const onkeydown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) return

    if (isTyping(event.target)) return

    const href = Match.value(event.key).pipe(
      Match.when('ArrowLeft', () => backHref),
      Match.when('ArrowRight', () => forwardHref),
      Match.orElse(() => null),
    )

    if (!href) return
    event.preventDefault()
    void goto(href)
  }
</script>

<svelte:window {onkeydown} />

{#snippet arrow(
  href: string | null,
  label: string,
  size: number,
  className: string,
  forward: boolean,
)}
  {#if href}
    <a
      {href}
      aria-label={label}
      class="{className} touch-none select-none text-muted-foreground no-underline transition-colors [-webkit-touch-callout:none] hover:bg-muted/60 hover:text-foreground"
      onpointerdown={forward ? startHold : undefined}
      onpointerup={forward ? endHold : undefined}
      onpointerleave={forward ? endHold : undefined}
      onpointercancel={forward ? endHold : undefined}
      onclick={forward ? skipClickAfterHold : undefined}
    >
      {#if forward}<ChevronRight {size} />{:else}<ChevronLeft {size} />{/if}
    </a>
  {:else}
    <span
      aria-label={label}
      aria-disabled="true"
      class="{className} cursor-not-allowed text-muted-foreground opacity-25"
    >
      {#if forward}<ChevronRight {size} />{:else}<ChevronLeft {size} />{/if}
    </span>
  {/if}
{/snippet}

<nav aria-label="Tweet navigation" aria-busy={loading} class="mb-6 lg:mb-0">
  <div class="flex items-center gap-1 lg:hidden">
    {@render arrow(
      backHref,
      'Previous tweet',
      16,
      'inline-flex size-8 items-center justify-center',
      false,
    )}
    {@render arrow(
      forwardHref,
      forwardLabel,
      16,
      'inline-flex size-8 items-center justify-center',
      true,
    )}
  </div>
  {@render arrow(
    backHref,
    'Previous tweet',
    24,
    'fixed left-[max(1rem,calc(50%-30rem))] top-1/2 z-30 hidden size-11 -translate-y-1/2 items-center justify-center lg:flex',
    false,
  )}
  {@render arrow(
    forwardHref,
    forwardLabel,
    24,
    'fixed right-[max(1rem,calc(50%-30rem))] top-1/2 z-30 hidden size-11 -translate-y-1/2 items-center justify-center lg:flex',
    true,
  )}

  <form bind:this={randomForm} method="POST" action="?/random" use:enhance hidden></form>

  <div class="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
    {#if loading}
      <span role="status" class="bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm"
        >Loading tweet…</span
      >
    {:else if randomMessage}
      <span role="alert" class="bg-card px-3 py-1 text-xs text-destructive shadow-sm"
        >{randomMessage}</span
      >
    {/if}
  </div>
</nav>
