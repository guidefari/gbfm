<script lang="ts">
  import AccountForm from '@/lib/components/account/AccountForm.svelte'
  let sent = $state('')
</script>
<svelte:head><title>Forgot password</title></svelte:head>
{#if sent}<section class="mx-auto max-w-xl px-4 py-20"><h1 class="text-4xl font-black">Check your inbox.</h1><p class="mt-4">We sent a reset link to {sent}.</p></section>{:else}<AccountForm title="Reset your password" description="Enter the email tied to your account." submitLabel="Send reset email" endpoint="/auth/request-password-reset" fields={[{name:'email',label:'Email',type:'email'}]} transform={(v) => ({email:v.email, redirectTo:`${location.origin}/auth/reset-password`})} onSuccess={(values) => sent=values.email} />{/if}
