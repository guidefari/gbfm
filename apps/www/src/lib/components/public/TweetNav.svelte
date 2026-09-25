<script lang="ts">
  import { goto, preloadData } from '$app/navigation'
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'
  import { Option, Schema } from 'effect'
  import { onMount } from 'svelte'

  const Result = Schema.Struct({
    destination: Schema.Struct({ slug: Schema.String }),
    capabilities: Schema.Struct({
      canStepBack: Schema.Boolean,
      canStepForward: Schema.Boolean,
      hasUnread: Schema.Boolean
    }),
    neighbours: Schema.Struct({
      back: Schema.optional(Schema.String),
      forward: Schema.optional(Schema.String)
    }),
    neighbourhood: Schema.optional(
      Schema.Struct({ back: Schema.Array(Schema.String), forward: Schema.Array(Schema.String) })
    )
  })
  type Result = typeof Result.Type
  type Command =
    | { _tag: 'Step'; direction: 'Back' | 'Forward' }
    | { _tag: 'Jump' }
    | { _tag: 'Open'; slug: string }

  let { slug }: { slug: string } = $props()
  let result = $state<Result | null>(null)
  let busy = $state(false)
  let showStatus = $state(false)
  let message = $state('')
  let holdTimer: ReturnType<typeof setTimeout> | undefined
  let statusTimer: ReturnType<typeof setTimeout> | undefined
  let held = false
  let intent = 0

  const canBack = $derived(result?.capabilities.canStepBack ?? true)
  const canForward = $derived(result?.capabilities.canStepForward ?? true)
  const hasUnread = $derived(result?.capabilities.hasUnread ?? false)

  async function request(path: 'peek' | 'visit', command: Command) {
    const response = await fetch(`/api/content/posts/micro/navigate/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        command,
        from: slug,
        intentToken: path === 'visit' ? crypto.randomUUID() : undefined
      })
    })
    if (!response.ok) throw new Error('Navigation unavailable')
    return path === 'visit'
      ? null
      : Option.getOrNull(Schema.decodeUnknownOption(Result)(await response.json()))
  }

  function accept(next: Result | null) {
    if (!next) return
    result = next
    const targets = next.neighbourhood
      ? [...next.neighbourhood.back.slice(0, 3), ...next.neighbourhood.forward.slice(0, 3)]
      : [next.neighbours.back, next.neighbours.forward]
    for (const target of new Set(targets.filter((value): value is string => Boolean(value)))) {
      void preloadData(`/tweet/${encodeURIComponent(target)}`)
    }
  }

  async function navigate(command: Extract<Command, { _tag: 'Step' | 'Jump' }>) {
    if (busy) return
    const currentIntent = ++intent
    const expected =
      command._tag === 'Step'
        ? command.direction === 'Back'
          ? result?.neighbours.back
          : result?.neighbours.forward
        : undefined
    busy = true
    message = ''
    statusTimer = setTimeout(() => {
      if (intent === currentIntent) showStatus = true
    }, 400)

    void request('visit', command).catch(() => undefined)

    try {
      const peek = request('peek', command)
      if (expected) await Promise.all([goto(`/tweet/${encodeURIComponent(expected)}`), peek])
      else {
        const next = await peek
        if (!next) throw new Error('Invalid navigation response')
        await goto(`/tweet/${encodeURIComponent(next.destination.slug)}`)
      }
    } catch {
      if (intent === currentIntent) message = 'Could not load another tweet.'
    } finally {
      if (intent === currentIntent) {
        if (statusTimer) clearTimeout(statusTimer)
        showStatus = false
        busy = false
      }
    }
  }

  function startHold() {
    held = false
    holdTimer = setTimeout(() => {
      held = true
      void navigate({ _tag: 'Jump' })
    }, 900)
  }

  function cancelHold(runTap: boolean) {
    if (holdTimer) clearTimeout(holdTimer)
    holdTimer = undefined
    if (runTap && !held) void navigate({ _tag: 'Step', direction: 'Forward' })
  }

  $effect(() => {
    const currentSlug = slug
    result = null
    void request('peek', { _tag: 'Open', slug: currentSlug }).then(accept).catch(() => undefined)
    void request('visit', { _tag: 'Open', slug: currentSlug }).catch(() => undefined)
  })

  onMount(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return
      if (event.key === 'ArrowLeft' && canBack) {
        event.preventDefault()
        void navigate({ _tag: 'Step', direction: 'Back' })
      }
      if (event.key === 'ArrowRight' && canForward) {
        event.preventDefault()
        void navigate({ _tag: 'Step', direction: 'Forward' })
      }
    }
    window.addEventListener('keydown', keydown)
    return () => {
      window.removeEventListener('keydown', keydown)
      if (holdTimer) clearTimeout(holdTimer)
      if (statusTimer) clearTimeout(statusTimer)
    }
  })
</script>

<nav aria-label="Tweet navigation" aria-busy={busy}>
  <div class="flex items-center gap-1 lg:hidden">
    <button type="button" aria-label="Previous tweet" disabled={!canBack || busy} class="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-25" onclick={() => void navigate({ _tag: 'Step', direction: 'Back' })}><ChevronLeft size={16} /></button>
    <button type="button" aria-label={hasUnread ? 'Next tweet (hold for random)' : 'Next tweet'} disabled={!canForward || busy} class="inline-flex size-8 touch-none items-center justify-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-25" onpointerdown={startHold} onpointerup={() => cancelHold(true)} onpointerleave={() => cancelHold(false)} onpointercancel={() => cancelHold(false)} onclick={(event) => { if (event.detail === 0) void navigate({ _tag: 'Step', direction: 'Forward' }) }}><ChevronRight size={16} /></button>
  </div>

  <button type="button" aria-label="Previous tweet" disabled={!canBack || busy} class="fixed left-[max(1rem,calc(50%-30rem))] top-1/2 z-30 hidden size-11 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20 lg:flex" onclick={() => void navigate({ _tag: 'Step', direction: 'Back' })}><ChevronLeft size={24} /></button>
  <button type="button" aria-label={hasUnread ? 'Next tweet (hold for random)' : 'Next tweet'} disabled={!canForward || busy} class="fixed right-[max(1rem,calc(50%-30rem))] top-1/2 z-30 hidden size-11 -translate-y-1/2 touch-none items-center justify-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20 lg:flex" onpointerdown={startHold} onpointerup={() => cancelHold(true)} onpointerleave={() => cancelHold(false)} onpointercancel={() => cancelHold(false)} onclick={(event) => { if (event.detail === 0) void navigate({ _tag: 'Step', direction: 'Forward' }) }}><ChevronRight size={24} /></button>

  <div class="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
    {#if showStatus}<span role="status" class="bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">Loading tweet…</span>{:else if message}<span role="alert" class="bg-card px-3 py-1 text-xs text-destructive shadow-sm">{message}</span>{/if}
  </div>
</nav>
