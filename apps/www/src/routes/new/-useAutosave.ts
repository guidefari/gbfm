import { useEffect, useRef } from 'react'

const AUTOSAVE_DELAY_MS = 2000

export function useAutosave({
  enabled,
  dirtyKey,
  onSave
}: {
  enabled: boolean
  dirtyKey: string
  onSave: () => void
}) {
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const lastSavedKey = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || lastSavedKey.current === dirtyKey) return () => {}

    const timeout = window.setTimeout(() => {
      lastSavedKey.current = dirtyKey
      onSaveRef.current()
    }, AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [enabled, dirtyKey])
}
