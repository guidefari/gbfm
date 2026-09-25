<script lang="ts">
  let {
    endpoint,
    method = 'PATCH',
    fields,
  }: {
    endpoint: string
    method?: string
    fields: Array<{ name: string; label: string; type?: string; value?: string }>
  } = $props()

  let pending = $state(false),
    message = $state('')

  let formElement = $state<HTMLFormElement | null>(null)

  async function submit() {
    if (!formElement) return
    pending = true
    message = ''
    const form = new FormData(formElement)
    const body = Object.fromEntries(form.entries())

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })

      message = response.ok ? 'Saved.' : `Could not save (${response.status}).`
    } catch {
      message = 'Could not save.'
    } finally {
      pending = false
    }
  }
</script>

<form
  bind:this={formElement}
  class="max-w-2xl space-y-4 rounded border p-5"
  onsubmit={(event) => {
    event.preventDefault()
    void submit()
  }}
>
  {#each fields as field}<label class="block"
      ><span class="mb-1 block text-sm font-semibold">{field.label}</span><input
        class="w-full rounded border bg-background px-3 py-2"
        name={field.name}
        type={field.type ?? 'text'}
        value={field.value ?? ''}
      /></label
    >{/each}
  <button
    class="rounded bg-foreground px-4 py-2 font-semibold text-background disabled:opacity-50"
    disabled={pending}>{pending ? 'Saving…' : 'Save'}</button
  >
  {#if message}<span class="ml-3 text-sm" aria-live="polite">{message}</span>{/if}
</form>
