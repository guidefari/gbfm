<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { Schema } from 'effect'
  import AccountForm from '@/lib/components/account/AccountForm.svelte'

  const target = page.url.searchParams.get('redirect')

  const redirect = target?.startsWith('/') && !target.startsWith('//') ? target : '/'

  const signInPayload = (values: Record<string, string>): Schema.Json => {
    const identifier = values.identifier ?? ''
    const password = values.password ?? ''

    if (identifier.includes('@')) return { email: identifier, password }

    return { username: identifier, password }
  }

  const signInEndpoint = (values: Record<string, string>) =>
    (values.identifier ?? '').includes('@') ? '/auth/sign-in/email' : '/auth/sign-in/username'
</script>

<svelte:head><title>Sign in</title></svelte:head>
<AccountForm
  title="Welcome back."
  description="Sign in to pick up where you left off."
  submitLabel="Sign in"
  endpoint={signInEndpoint}
  fields={[
    { name: 'identifier', label: 'Email or username', autocomplete: 'username' },
    { name: 'password', label: 'Password', type: 'password', autocomplete: 'current-password' },
  ]}
  transform={signInPayload}
  onSuccess={() => void goto(redirect, { invalidateAll: true })}
/>
