import { useCallback, useEffect, useState } from 'react'

export function useCooldown(seconds: number) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (remaining <= 0) return
    const id = setTimeout(() => setRemaining((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining])

  const start = useCallback(() => setRemaining(seconds), [seconds])
  const reset = useCallback(() => setRemaining(0), [])

  return { remaining, isActive: remaining > 0, start, reset }
}
