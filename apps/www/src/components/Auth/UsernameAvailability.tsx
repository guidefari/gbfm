import { useQuery } from '@tanstack/react-query'
import { Check, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'

const MIN_LENGTH = 3
const DEBOUNCE_MS = 400

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function useUsernameAvailability(username: string) {
  const trimmed = username.trim()
  const debounced = useDebounced(trimmed, DEBOUNCE_MS)
  const enabled = debounced.length >= MIN_LENGTH

  const { data, isFetching } = useQuery({
    queryKey: ['username-availability', debounced],
    queryFn: async () => {
      const res = await authClient.isUsernameAvailable({ username: debounced })
      return res.data
    },
    enabled
  })

  if (!enabled)
    return { state: 'idle' as const, available: false, isFetching: false }
  if (isFetching || debounced !== trimmed)
    return { state: 'checking' as const, available: false, isFetching: true }
  if (data?.available)
    return { state: 'available' as const, available: true, isFetching: false }
  return { state: 'taken' as const, available: false, isFetching: false }
}

export function UsernameAvailability({ username }: { username: string }) {
  const { state } = useUsernameAvailability(username)

  if (state === 'idle') return null
  if (state === 'checking')
    return (
      <Loader2
        className='h-4 w-4 animate-spin text-muted-foreground'
        aria-label='Checking username'
      />
    )
  if (state === 'available')
    return (
      <Check
        className='h-4 w-4 text-gb-pastel-green-2'
        aria-label='Username available'
      />
    )
  return <X className='h-4 w-4 text-red-400' aria-label='Username taken' />
}
