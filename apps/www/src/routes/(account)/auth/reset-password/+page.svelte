<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import AccountForm from '@/lib/components/account/AccountForm.svelte'
  const token = page.url.searchParams.get('token')
</script>
<svelte:head><title>Reset password</title></svelte:head>
{#if token}<AccountForm title="Choose a new password" description="Set a fresh password for your account." submitLabel="Reset password" endpoint="/api/invite/confirm" fields={[{name:'password',label:'New password',type:'password',autocomplete:'new-password'},{name:'confirmPassword',label:'Confirm password',type:'password',autocomplete:'new-password'}]} transform={(v) => { if(v.password !== v.confirmPassword) throw new Error('Passwords do not match.'); return {token,password:v.password} }} onSuccess={() => void goto('/')} />{:else}<section class="mx-auto max-w-xl px-4 py-20"><h1 class="text-4xl font-black">That reset link is no longer valid</h1><a class="mt-6 inline-block" href="/auth/forgot-password">Request another reset email</a></section>{/if}
