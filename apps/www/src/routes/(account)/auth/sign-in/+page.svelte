<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { Schema } from 'effect'
  import AccountForm from '@/lib/components/account/AccountForm.svelte'

  const target = page.url.searchParams.get('redirect')

  const redirect = target?.startsWith('/') && !target.startsWith('//') ? target : '/'

  const signInPayload = (values: Record<string, string>): Schema.Json => {
    if (values.identifier.includes('@')) return { email: values.identifier, password: values.password }

    return { username: values.identifier, password: values.password }
  }
</script>
<svelte:head><title>Sign in</title></svelte:head>
<AccountForm
  title="Welcome back."
  description="Sign in to pick up where you left off."
  submitLabel="Sign in"
  endpoint={(values) => values.identifier.includes('@') ? '/auth/sign-in/email' : '/auth/sign-in/username'}
  fields={[{name:'identifier',label:'Email or username',autocomplete:'username'},{name:'password',label:'Password',type:'password',autocomplete:'current-password'}]}
  transform={signInPayload}
  onSuccess={() => void goto(redirect, { invalidateAll: true })}
/>
