<script lang="ts">
  import { buttonVariants } from '@gbfm/ui/button-variants'
  import { Bell, BellOff, Heart, Loader2, Share2 } from 'lucide-svelte'
  import { onMount } from 'svelte'
  import { cn } from '@/lib/utils'
  import AuthPromptDialog from './AuthPromptDialog.svelte'

  let {
    id,
    title,
    kind,
    slug,
    initialActive = false,
    compact = false,
  }: {
    id?: string
    title: string
    kind: 'audio' | 'show' | 'content'
    slug: string
    initialActive?: boolean
    compact?: boolean
  } = $props()

  let busy = $state(false)

  let interactive = $state(false)

  let status = $state('')

  let active = $derived(initialActive)

  let authOpen = $state(false)

  let retryAfterAuthentication = false

  onMount(() => {
    interactive = true
  })

  const buttonClass = $derived(
    compact
      ? cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          'size-7 rounded-none border-0 bg-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-highlight hover:shadow-none',
        )
      : buttonVariants({ variant: 'outline', size: 'sm' }),
  )

  const toggleLabel = $derived(
    kind === 'show'
      ? active
        ? 'Unsubscribe'
        : 'Subscribe'
      : active
        ? 'Remove from favorites'
        : 'Add to favorites',
  )

  const share = async () => {
    const url = new URL(slug, window.location.origin).href

    try {
      if (navigator.share) await navigator.share({ title, url })
      else {
        await navigator.clipboard.writeText(url)
        status = 'Link copied'
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      status = 'Could not share this page'
    }
  }

  const toggle = async () => {
    if (!id || busy) return
    busy = true
    status = ''

    const endpoint =
      kind === 'show' && active
        ? `/api/shows/${id}/unsubscribe`
        : kind === 'show'
          ? `/api/shows/${id}/subscribe`
          : active
            ? `/api/favorites/${id}`
            : '/api/favorites'

    const init: RequestInit = {
      method: active ? 'DELETE' : 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
    }

    if (!active && kind === 'audio') init.body = JSON.stringify({ audioId: id })
    const response = await fetch(endpoint, init).catch(() => null)

    if (response?.ok) {
      active = !active
      status = active
        ? kind === 'show'
          ? 'Subscribed'
          : 'Added to favorites'
        : kind === 'show'
          ? 'Unsubscribed'
          : 'Removed from favorites'
    } else if (response?.status === 401) {
      retryAfterAuthentication = true
      authOpen = true
    } else status = 'Action failed. Please try again.'
    busy = false
  }
</script>

<div class={cn('flex flex-wrap items-center', compact ? 'gap-1' : 'gap-2')}>
  {#if kind !== 'content' && id}<button
      type="button"
      class={buttonClass}
      disabled={busy || !interactive}
      aria-label={toggleLabel}
      title={toggleLabel}
      onclick={toggle}
    >
      {#if busy}<Loader2
          class="size-4 animate-spin"
        />{:else if kind === 'show'}{#if active}<BellOff class="size-4" />{:else}<Bell
            class="size-4"
          />{/if}{:else}<Heart class={cn('size-4', active && 'fill-red-500 text-red-500')} />{/if}
    </button>{/if}
  <button
    type="button"
    class={buttonClass}
    disabled={!interactive}
    aria-label="Share"
    title="Share"
    onclick={share}><Share2 class="size-4" /></button
  >
  {#if status}<span class="text-xs text-muted-foreground" role="status">{status}</span>{/if}
</div>
<AuthPromptDialog
  bind:open={authOpen}
  action={kind === 'show' ? 'subscribe' : 'favorite'}
  returnPath={slug}
  onAuthenticated={() => {
    if (retryAfterAuthentication) {
      retryAfterAuthentication = false
      void toggle()
    }
  }}
/>
