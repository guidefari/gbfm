<script lang="ts">
  import { Option, Schema } from 'effect'
  import { onMount } from 'svelte'
  import type { HTMLInputAttributes } from 'svelte/elements'

  const ErrorResponse = Schema.Struct({ message: Schema.optional(Schema.String) })

  type Field = {
    name: string
    label: string
    type?: HTMLInputAttributes['type']
    autocomplete?: HTMLInputAttributes['autocomplete']
  }

  let {
    title,
    description,
    fields,
    submitLabel,
    endpoint,
    transform = (values) => values,
    onSuccess = () => undefined
  }: {
    title: string
    description: string
    fields: Array<Field>
    submitLabel: string
    endpoint: string | ((values: Record<string, string>) => string)
    transform?: (values: Record<string, string>) => Schema.Json
    onSuccess?: (values: Record<string, string>) => void
  } = $props()

  let pending = $state(false)

  let hydrated = $state(false)

  let error = $state('')

  let success = $state('')

  onMount(() => (hydrated = true))

  async function submit(event: SubmitEvent) {
    pending = true
    error = ''
    success = ''
    const formElement = event.currentTarget

    if (!(formElement instanceof HTMLFormElement)) return
    const form = new FormData(formElement)
    const values = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]))

    try {
      const target = Schema.is(Schema.String)(endpoint) ? endpoint : endpoint(values)

      const response = await fetch(target, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(transform(values))
      })

      if (!response.ok) {
        const input: Schema.Json = await response.json().catch(() => null)
        const parsed = Option.getOrNull(Schema.decodeUnknownOption(ErrorResponse)(input))
        throw new Error(parsed?.message ?? 'The request could not be completed.')
      }

      success = 'Done.'
      onSuccess(values)
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'The request could not be completed.'
    } finally {
      pending = false
    }
  }
</script>

<section class="mx-auto max-w-xl px-4 py-16">
  <p class="text-xs font-bold uppercase tracking-[.25em] text-highlight">Account</p>
  <h1 class="mt-2 text-4xl font-black">{title}</h1>
  <p class="mt-3 text-muted-foreground">{description}</p>
  {#if error}<p role="alert" class="mt-6 border border-destructive p-3 text-destructive">{error}</p>{/if}
  {#if success}<p role="status" class="mt-6 border border-highlight p-3">{success}</p>{/if}
  <form class="mt-8 grid gap-5" onsubmit={(event) => { event.preventDefault(); void submit(event) }}>
    {#each fields as field}
      <label class="grid gap-2 font-semibold">
        {field.label}
        <input class="border border-border bg-background px-3 py-2" name={field.name} type={field.type ?? 'text'} autocomplete={field.autocomplete} required />
      </label>
    {/each}
    <button class="bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-50" disabled={!hydrated || pending}>
      {pending ? 'Working…' : submitLabel}
    </button>
  </form>
  <div class="mt-6 flex gap-4 text-sm"><a href="/auth/sign-in">Sign in</a><a href="/auth/sign-up">Create account</a><a href="/auth/forgot-password">Forgot password?</a></div>
</section>
