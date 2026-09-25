<script lang="ts">
  import { Option, Schema } from 'effect'

  const UsernameAvailability = Schema.Struct({ available: Schema.Boolean })

  const ErrorResponse = Schema.Struct({ message: Schema.optional(Schema.String) })

  let sentEmail = $state('')

  let email = $state('')

  let name = $state('')

  let username = $state('')

  let password = $state('')

  let availability = $state<'idle' | 'checking' | 'available' | 'taken'>('idle')

  let error = $state('')

  let pending = $state(false)

  let resendPending = $state(false)

  let resendMessage = $state('')

  let cooldown = $state(0)

  let checkSequence = 0

  const passwordChecks = $derived([
    ['At least 8 characters', password.length >= 8],
    ['An uppercase and lowercase letter', /[a-z]/.test(password) && /[A-Z]/.test(password)],
    ['A number', /\d/.test(password)],
  ] as const)

  const passwordValid = $derived(passwordChecks.every(([, valid]) => valid))

  async function checkUsername(value: string) {
    username = value
    const sequence = ++checkSequence
    const candidate = value.trim()

    if (candidate.length < 3) {
      availability = 'idle'

      return
    }

    availability = 'checking'
    await new Promise((resolve) => setTimeout(resolve, 400))

    if (sequence !== checkSequence) return

    try {
      const response = await fetch(
        `/auth/is-username-available?username=${encodeURIComponent(candidate)}`,
      )

      const input: Schema.Json = await response.json()
      const body = Option.getOrNull(Schema.decodeUnknownOption(UsernameAvailability)(input))
      availability = response.ok && body?.available === true ? 'available' : 'taken'
    } catch {
      availability = 'idle'
    }
  }

  function startCooldown() {
    cooldown = 30

    const timer = setInterval(() => {
      cooldown -= 1

      if (cooldown <= 0) clearInterval(timer)
    }, 1000)
  }

  async function submit() {
    pending = true
    error = ''

    try {
      const response = await fetch('/auth/sign-up/email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, name, username: username.trim(), password }),
      })

      const input: Schema.Json = await response.json().catch(() => null)
      const body = Option.getOrNull(Schema.decodeUnknownOption(ErrorResponse)(input))

      if (!response.ok) throw new Error(body?.message ?? 'Failed to sign up.')
      sentEmail = email
      startCooldown()
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Failed to sign up.'
    } finally {
      pending = false
    }
  }

  async function resend() {
    resendPending = true
    resendMessage = ''

    const response = await fetch('/auth/send-verification-email', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: sentEmail }),
    })

    resendPending = false
    resendMessage = response.ok ? 'Sent. Check your inbox.' : 'Failed to resend.'

    if (response.ok) startCooldown()
  }
</script>

<section class="mx-auto max-w-4xl px-4 py-16">
  {#if sentEmail}
    <div class="mx-auto max-w-xl text-center">
      <h1 class="text-4xl font-black">Almost there.</h1>
      <p class="mt-4">We sent a verification link to <strong>{sentEmail}</strong>.</p>
      <p class="mt-6 text-muted-foreground">
        Didn't get it? Check spam, or <button
          class="underline"
          disabled={cooldown > 0 || resendPending}
          onclick={() => void resend()}
          >{resendPending
            ? 'Sending…'
            : cooldown > 0
              ? `resend in ${cooldown}s`
              : 'resend email'}</button
        >.
      </p>
      {#if resendMessage}<p role="status" class="mt-3">{resendMessage}</p>{/if}
    </div>
  {:else}
    <div class="grid gap-10 md:grid-cols-[1fr_18rem]">
      <div>
        <p class="text-xs font-bold uppercase tracking-[.25em] text-highlight">Create account</p>
        <h1 class="mt-2 text-4xl font-black">Create your listener account</h1>
        <p class="mt-3 text-muted-foreground">Save favorites and keep your place in the archive.</p>
        {#if error}<p role="alert" class="mt-5 border border-destructive p-3 text-destructive">
            {error}
          </p>{/if}
        <form
          class="mt-8 grid gap-5"
          onsubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label class="grid gap-2 font-semibold"
            >Email<input
              class="border bg-background px-3 py-2"
              bind:value={email}
              type="email"
              autocomplete="email"
              required
            /></label
          >
          <label class="grid gap-2 font-semibold"
            >Display name<input
              class="border bg-background px-3 py-2"
              bind:value={name}
              autocomplete="name"
              required
            /></label
          >
          <label class="grid gap-2 font-semibold"
            >Username<input
              class="border bg-background px-3 py-2"
              value={username}
              oninput={(event) => void checkUsername(event.currentTarget.value)}
              autocomplete="username"
              minlength="3"
              required
            /><span class="text-xs text-muted-foreground" aria-live="polite"
              >{availability === 'checking'
                ? 'Checking…'
                : availability === 'available'
                  ? 'Username available'
                  : availability === 'taken'
                    ? 'Username is taken'
                    : 'At least 3 characters'}</span
            ></label
          >
          <label class="grid gap-2 font-semibold"
            >Password<input
              class="border bg-background px-3 py-2"
              bind:value={password}
              type="password"
              autocomplete="new-password"
              required
            /></label
          >
          <ul class="grid gap-1 text-xs">
            {#each passwordChecks as [label, valid]}<li
                class={valid ? 'text-highlight' : 'text-muted-foreground'}
              >
                {valid ? '✓' : '○'}
                {label}
              </li>{/each}
          </ul>
          <p class="text-xs text-muted-foreground">
            By creating an account, you agree to our <a href="/terms">Terms</a> and
            <a href="/privacy">Privacy Policy</a>.
          </p>
          <button
            class="bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-50"
            disabled={pending || !passwordValid || availability !== 'available'}
            >{pending ? 'Creating…' : 'Create account'}</button
          >
        </form>
      </div>
      <aside class="h-fit border p-5">
        <p class="text-xs font-bold uppercase text-muted-foreground">Profile preview</p>
        <div
          class="mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-2xl font-black"
        >
          {(name || username || '?').slice(0, 1).toUpperCase()}
        </div>
        <h2 class="mt-4 text-xl font-bold">{name || 'Your display name'}</h2>
        <p class="text-muted-foreground">@{username || 'username'}</p>
      </aside>
    </div>
  {/if}
</section>
