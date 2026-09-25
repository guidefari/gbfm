<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'

  let status = $state('Verifying your email…')

  $effect(() => { void (async () => { const token=page.url.searchParams.get('token');

 if(!token){status='Missing verification token.';

return}

 const response=await fetch(`/auth/verify-email?token=${encodeURIComponent(token)}`,{credentials:'include'});

 if(!response.ok){status='The verification link is invalid or expired.';

return}

 status='Email verified.'; const callback=page.url.searchParams.get('callbackURL'); setTimeout(() => void goto(callback?.startsWith('/') && !callback.startsWith('//') ? callback : '/'),800) })() })
</script>
<svelte:head><title>Verify email</title></svelte:head><section class="mx-auto max-w-xl px-4 py-20 text-center"><h1 class="text-4xl font-black">Email verification</h1><p role="status" class="mt-5">{status}</p></section>
