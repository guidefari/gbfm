<script lang="ts">
  import { Option, Schema } from 'effect'
  import { tick } from 'svelte'

  const ErrorResponse = Schema.Struct({ message: Schema.optional(Schema.String) })

  type Mode = 'choice' | 'sign-in' | 'sign-up'

  let {
    open = $bindable(false),
    action,
    returnPath,
    onAuthenticated = () => undefined
  }: {
    open?: boolean
    action: 'favorite' | 'subscribe'
    returnPath: string
    onAuthenticated?: () => void
  } = $props()

  let dialog = $state<HTMLDialogElement>()

  let mode = $state<Mode>('choice')

  let pending = $state(false)

  let error = $state('')

  let verificationEmail = $state('')

  $effect(() => {
    const element = dialog

    if (!element) return

    if (open && !element.open) void tick().then(() => element.showModal())

    if (!open && element.open) element.close()
  })

  function close() {
    open = false
    mode = 'choice'
    error = ''
    verificationEmail = ''
  }

  async function submit(event: SubmitEvent) {
    const form = event.currentTarget

    if (!(form instanceof HTMLFormElement) || pending) return

    const values = Object.fromEntries(
      [...new FormData(form).entries()].map(([key, value]) => [key, String(value)])
    )

    pending = true
    error = ''

    try {
      const isSignIn = mode === 'sign-in'
      const identifier = values.identifier ?? ''

      const endpoint = isSignIn
        ? identifier.includes('@')
          ? '/auth/sign-in/email'
          : '/auth/sign-in/username'
        : '/auth/sign-up/email'

      const payload = isSignIn
        ? identifier.includes('@')
          ? { email: identifier, password: values.password }
          : { username: identifier, password: values.password }
        : {
            email: values.email,
            name: values.name,
            username: values.username,
            password: values.password
          }

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const body = Option.getOrNull(
          Schema.decodeUnknownOption(ErrorResponse)(await response.json().catch(() => null))
        )

        throw new Error(body?.message ?? 'The request could not be completed.')
      }

      if (isSignIn) {
        close()
        onAuthenticated()
      } else verificationEmail = values.email ?? ''
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'The request could not be completed.'
    } finally {
      pending = false
    }
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="auth-prompt-title"
  aria-describedby="auth-prompt-description"
  class="m-auto w-[min(30rem,calc(100%-2rem))] border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/60"
  onclose={close}
  onclick={(event) => { if (event.target === dialog) close() }}
>
  <div class="p-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 id="auth-prompt-title" class="text-xl font-black">
          {mode === 'choice' ? `Sign in to ${action}` : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </h2>
        <p id="auth-prompt-description" class="mt-2 text-sm text-muted-foreground">
          {mode === 'choice' ? `Keep your ${action === 'favorite' ? 'favorites' : 'show subscriptions'} with a free listener account.` : 'You will stay on this page when you are done.'}
        </p>
      </div>
      <button type="button" class="px-2 text-xl" aria-label="Close" onclick={close}>×</button>
    </div>

    {#if error}<p role="alert" class="mt-4 border border-destructive p-3 text-sm text-destructive">{error}</p>{/if}
    {#if verificationEmail}
      <div class="mt-6" role="status"><p class="font-bold">Check your inbox.</p><p class="mt-2 text-sm text-muted-foreground">We sent a verification link to {verificationEmail}. After verifying, return here to continue.</p></div>
    {:else if mode === 'choice'}
      <div class="mt-6 grid gap-3">
        <button class="bg-primary px-4 py-3 font-bold text-primary-foreground" onclick={() => mode = 'sign-in'}>Sign in</button>
        <button class="border border-border px-4 py-3 font-bold" onclick={() => mode = 'sign-up'}>Create account</button>
      </div>
    {:else}
      <form class="mt-6 grid gap-4" onsubmit={(event) => { event.preventDefault(); void submit(event) }}>
        {#if mode === 'sign-in'}
          <label class="grid gap-2 font-semibold">Email or username<input class="border border-border bg-background px-3 py-2" name="identifier" autocomplete="username" required /></label>
          <label class="grid gap-2 font-semibold">Password<input class="border border-border bg-background px-3 py-2" name="password" type="password" autocomplete="current-password" required /></label>
        {:else}
          <label class="grid gap-2 font-semibold">Email<input class="border border-border bg-background px-3 py-2" name="email" type="email" autocomplete="email" required /></label>
          <label class="grid gap-2 font-semibold">Display name<input class="border border-border bg-background px-3 py-2" name="name" autocomplete="name" required /></label>
          <label class="grid gap-2 font-semibold">Username<input class="border border-border bg-background px-3 py-2" name="username" autocomplete="username" minlength="3" required /></label>
          <label class="grid gap-2 font-semibold">Password<input class="border border-border bg-background px-3 py-2" name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
        {/if}
        <button class="bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-50" disabled={pending}>{pending ? 'Working…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
        <button type="button" class="text-sm underline" onclick={() => { mode = 'choice'; error = '' }}>Back</button>
      </form>
    {/if}
    <noscript><a href={`/auth/sign-in?redirect=${encodeURIComponent(returnPath)}`}>Sign in</a></noscript>
  </div>
</dialog>
