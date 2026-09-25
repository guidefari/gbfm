<script lang="ts">
  let { mode, token }: { mode: 'subscribe' | 'unsubscribe'; token?: string } = $props()

  let pending = $state(false)

  let complete = $state(false)

  let error = $state('')

  async function request(payload: Record<string, string>) {
    pending = true
    error = ''

    const path =
      mode === 'subscribe'
        ? '/api/newsletter/subscribe'
        : token
          ? '/api/newsletter/unsubscribe'
          : '/api/newsletter/request-unsubscribe'

    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    pending = false

    if (!response.ok) {
      error = 'Something went wrong. Please try again.'

      return
    }

    complete = true
  }

  $effect(() => {
    if (token) void request({ token })
  })
</script>

<section class="mx-auto max-w-xl px-4 py-20 text-center">
  <h1 class="text-4xl font-black">{mode === 'subscribe' ? 'Stay in the loop' : 'Unsubscribe'}</h1>
  <p class="mt-3 text-muted-foreground">
    {mode === 'subscribe'
      ? 'New mixes, notable drops, and occasional updates.'
      : 'Leave the mailing list at any time.'}
  </p>
  {#if complete}
    <p role="status" class="mt-8 border border-highlight p-6">
      {mode === 'subscribe'
        ? "You're subscribed."
        : token
          ? "You've been removed from the mailing list."
          : 'Check your inbox for an unsubscribe link.'}
    </p>
  {:else if token && pending}<p class="mt-8">Unsubscribing…</p>
  {:else}
    <form
      class="mt-8 grid gap-3"
      onsubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        void request(Object.fromEntries([...data].map(([k, v]) => [k, String(v)])))
      }}
    >
      {#if mode === 'subscribe'}<input
          class="border bg-background p-3"
          name="name"
          placeholder="Your name (optional)"
        />{/if}
      <input
        class="border bg-background p-3"
        name="email"
        type="email"
        placeholder="Email address"
        required
      />
      <button class="bg-primary p-3 font-bold text-primary-foreground" disabled={pending}
        >{pending ? 'Working…' : mode === 'subscribe' ? 'Subscribe' : 'Send link'}</button
      >
    </form>
  {/if}
  {#if error}<p role="alert" class="mt-4 text-destructive">{error}</p>{/if}
</section>
