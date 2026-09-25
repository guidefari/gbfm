<script lang="ts">
  import AuthPromptDialog from './AuthPromptDialog.svelte'

  let { id, title, kind, slug, initialActive = false }: { id?: string; title: string; kind: 'audio' | 'show' | 'content'; slug: string; initialActive?: boolean } = $props()

  let busy = $state(false)

  let status = $state('')

  let active = $derived(initialActive)

  let authOpen = $state(false)

  let retryAfterAuthentication = false

  const share = async () => {
    const url = new URL(slug, window.location.origin).href

    try {
      if (navigator.share) await navigator.share({ title, url })
      else { await navigator.clipboard.writeText(url); status = 'Link copied' }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      status = 'Could not share this page'
    }
  }

  const toggle = async () => {
    if (!id || busy) return
    busy = true
    status = ''
    const endpoint = kind === 'show' && active ? `/api/shows/${id}/unsubscribe` : kind === 'show' ? `/api/shows/${id}/subscribe` : active ? `/api/favorites/${id}` : '/api/favorites'

    const response = await fetch(endpoint, {
      method: active ? 'DELETE' : 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: !active && kind === 'audio' ? JSON.stringify({ audioId: id }) : undefined
    }).catch(() => null)

    if (response?.ok) { active = !active; status = active ? (kind === 'show' ? 'Subscribed' : 'Added to favorites') : (kind === 'show' ? 'Unsubscribed' : 'Removed from favorites') }
    else if (response?.status === 401) { retryAfterAuthentication = true; authOpen = true }
    else status = 'Action failed. Please try again.'
    busy = false
  }
</script>

<div class="flex flex-wrap items-center gap-2">
  {#if kind !== 'content' && id}<button class="border border-border px-3 py-2 text-sm font-bold" disabled={busy} onclick={toggle}>{busy ? 'Working…' : active ? (kind === 'show' ? 'Subscribed' : 'Favorited') : (kind === 'show' ? 'Subscribe' : 'Favorite')}</button>{/if}
  <button class="border border-border px-3 py-2 text-sm font-bold" onclick={share}>Share</button>
  {#if status}<span class="text-xs text-muted-foreground" role="status">{status}</span>{/if}
</div>
<AuthPromptDialog bind:open={authOpen} action={kind === 'show' ? 'subscribe' : 'favorite'} returnPath={slug} onAuthenticated={() => { if (retryAfterAuthentication) { retryAfterAuthentication = false; void toggle() } }} />
