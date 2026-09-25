<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  const token = page.url.searchParams.get('token')

  const linkError = page.url.searchParams.get('error')

  let password = $state('')

  let confirmation = $state('')

  let pending = $state(false)

  let error = $state('')

  const checks = $derived([
    ['At least 8 characters', password.length >= 8],
    ['An uppercase and lowercase letter', /[a-z]/.test(password) && /[A-Z]/.test(password)],
    ['A number', /\d/.test(password)]
  ] as const)

  const valid = $derived(checks.every(([, passed]) => passed))

  async function submit() {
    error = ''

    if (!valid) return

    if (password !== confirmation) { error = 'Passwords do not match.';

 return }

    if (!token) return
    pending = true

    try {
      const response = await fetch('/api/invite/confirm', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password }) })

      if (!response.ok) throw new Error('Failed to reset password. The link may have expired.')
      await goto('/', { invalidateAll: true })
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Failed to reset password.' }
    finally { pending = false }
  }
</script>

<svelte:head><title>Reset password</title></svelte:head>
{#if !token || linkError}
  <section class="mx-auto max-w-xl px-4 py-20">
    <p class="text-xs font-bold uppercase tracking-[.25em] text-highlight">Reset link</p>
    <h1 class="mt-2 text-4xl font-black">That reset link is no longer valid</h1>
    {#if linkError}<p role="alert" class="mt-5 border border-destructive p-3 text-destructive">Invalid or expired reset link. Please request a new password reset.</p>{/if}
    <p class="mt-5 text-muted-foreground">Reset links expire for safety. The newest link in your inbox is the one to use.</p>
    <a class="mt-6 inline-block font-semibold underline" href="/auth/forgot-password">Request another reset email</a>
  </section>
{:else}
  <section class="mx-auto max-w-xl px-4 py-16">
    <p class="text-xs font-bold uppercase tracking-[.25em] text-highlight">Reset password</p>
    <h1 class="mt-2 text-4xl font-black">Choose a new password</h1>
    <p class="mt-3 text-muted-foreground">Set a fresh password and we will log you straight in.</p>
    {#if data.principal._tag === 'Authenticated'}<p class="mt-6 border border-amber-500/50 bg-amber-500/10 p-3" role="status">You’re currently signed in as {data.principal.email}. Setting a password here will switch to the account from the reset link.</p>{/if}
    {#if error}<p class="mt-4 border border-destructive p-3 text-destructive" role="alert">{error}</p>{/if}
    <form class="mt-8 grid gap-5" onsubmit={(event) => { event.preventDefault(); void submit() }}>
      <label class="grid gap-2 font-semibold">New password<input class="border bg-background px-3 py-2" bind:value={password} type="password" autocomplete="new-password" required /></label>
      <ul class="grid gap-1 text-xs">{#each checks as [label, passed]}<li class={passed ? 'text-highlight' : 'text-muted-foreground'}>{passed ? '✓' : '○'} {label}</li>{/each}</ul>
      <label class="grid gap-2 font-semibold">Confirm password<input class="border bg-background px-3 py-2" bind:value={confirmation} type="password" autocomplete="new-password" required /></label>
      <button class="bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-50" disabled={pending || !valid}>{pending ? 'Resetting…' : 'Reset password'}</button>
    </form>
    <a class="mt-6 inline-block text-sm underline" href="/auth/sign-in">Sign in instead</a>
  </section>
{/if}
