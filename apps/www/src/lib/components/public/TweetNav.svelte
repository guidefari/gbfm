<script lang="ts">
  import { goto } from '$app/navigation'
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'
  import { Option, Schema } from 'effect'
  import { onMount } from 'svelte'

  const Result = Schema.Struct({
    destination: Schema.Struct({ slug: Schema.String }),
    capabilities: Schema.Struct({ canStepBack: Schema.Boolean, canStepForward: Schema.Boolean, hasUnread: Schema.Boolean })
  })
  type Command = { _tag: 'Step'; direction: 'Back' | 'Forward' } | { _tag: 'Jump' } | { _tag: 'Open'; slug: string }
  let { slug }: { slug: string } = $props()
  let canBack = $state(false)
  let canForward = $state(true)
  let hasUnread = $state(true)
  let busy = $state(false)
  let message = $state('')
  let holdTimer: ReturnType<typeof setTimeout> | undefined
  let held = false

  async function request(path: 'peek' | 'visit' | 'navigate', command: Command) {
    const body: Schema.Json = path === 'peek'
      ? { command, from: slug }
      : { command, from: slug, intentToken: crypto.randomUUID() }
    const response = await fetch(`/api/content/posts/micro/navigate${path === 'navigate' ? '' : `/${path}`}`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!response.ok) throw new Error('Navigation unavailable')
    return path === 'visit' ? null : Option.getOrNull(Schema.decodeUnknownOption(Result)(await response.json()))
  }

  function applyCapabilities(result: typeof Result.Type | null) {
    if (!result) return
    canBack = result.capabilities.canStepBack
    canForward = result.capabilities.canStepForward
    hasUnread = result.capabilities.hasUnread
  }

  async function navigate(command: Command) {
    if (busy) return
    busy = true; message = ''
    try {
      const result = await request('navigate', command)
      if (!result) throw new Error('Invalid navigation response')
      applyCapabilities(result)
      await goto(`/tweet/${encodeURIComponent(result.destination.slug)}`)
    } catch { message = 'Could not load another tweet.' }
    finally { busy = false }
  }

  function startHold() {
    held = false
    holdTimer = setTimeout(() => { held = true; void navigate({ _tag: 'Jump' }) }, 900)
  }
  function cancelHold(runTap: boolean) {
    if (holdTimer) clearTimeout(holdTimer)
    holdTimer = undefined
    if (runTap && !held) void navigate({ _tag: 'Step', direction: 'Forward' })
  }

  $effect(() => {
    const currentSlug = slug
    void request('peek', { _tag: 'Open', slug: currentSlug }).then(applyCapabilities).catch(() => undefined)
    void request('visit', { _tag: 'Open', slug: currentSlug }).catch(() => undefined)
  })

  onMount(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return
      if (event.key === 'ArrowLeft' && canBack) { event.preventDefault(); void navigate({ _tag: 'Step', direction: 'Back' }) }
      if (event.key === 'ArrowRight' && canForward) { event.preventDefault(); void navigate({ _tag: 'Step', direction: 'Forward' }) }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); if (holdTimer) clearTimeout(holdTimer) }
  })
</script>

<nav aria-label="Tweet navigation" aria-busy={busy} class="mb-6 flex items-center gap-1">
  <button type="button" aria-label="Previous tweet" disabled={!canBack || busy} class="inline-flex h-9 w-9 items-center justify-center disabled:opacity-25" onclick={() => void navigate({ _tag: 'Step', direction: 'Back' })}><ChevronLeft size={20} /></button>
  <button type="button" aria-label={hasUnread ? 'Next tweet (hold for random)' : 'Next tweet'} disabled={!canForward || busy} class="inline-flex h-9 w-9 touch-none items-center justify-center disabled:opacity-25" onpointerdown={startHold} onpointerup={() => cancelHold(true)} onpointerleave={() => cancelHold(false)} onpointercancel={() => cancelHold(false)} onclick={(event) => { if (event.detail === 0) void navigate({ _tag: 'Step', direction: 'Forward' }) }}><ChevronRight size={20} /></button>
  <button type="button" disabled={!hasUnread || busy} class="ml-2 text-xs font-bold text-muted-foreground disabled:opacity-40" onclick={() => void navigate({ _tag: 'Jump' })}>Random tweet</button>
  {#if busy}<span role="status" class="ml-3 text-xs text-muted-foreground">Loading tweet…</span>{:else if message}<span role="alert" class="ml-3 text-xs text-destructive">{message}</span>{/if}
</nav>
