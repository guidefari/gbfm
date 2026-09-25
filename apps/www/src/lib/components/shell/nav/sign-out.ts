import { goto } from '$app/navigation'

export const signOut = async () => {
  await fetch('/auth/sign-out', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  }).catch(() => null)
  await goto('/', { invalidateAll: true })
}
