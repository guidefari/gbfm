import * as React from 'react'
import { useUIStore } from '@/store/ui'

export const useDevActions = (closeCmd: () => void) => {
  const resetUI = useUIStore((s) => s.resetUI)

  const resetUIState = React.useCallback(() => {
    resetUI()
    closeCmd()
  }, [resetUI, closeCmd])

  const resetAudioPlayer = React.useCallback(() => {
    localStorage.removeItem('audio-player-store')
    closeCmd()
    window.location.reload()
  }, [closeCmd])

  const resetAll = React.useCallback(() => {
    localStorage.removeItem('audio-player-store')
    localStorage.removeItem('gbfm-ui-store')
    closeCmd()
    window.location.reload()
  }, [closeCmd])

  return {
    resetUIState,
    resetAudioPlayer,
    resetAll
  }
}
