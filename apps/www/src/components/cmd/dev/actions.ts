import { Effect } from 'effect'
import * as React from 'react'
import { RuntimeClient } from '@/effect/runtime-client'
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

  const runEffectExample = React.useCallback(() => {
    const program = Effect.gen(function* () {
      const timestamp = new Date().toISOString()
      yield* Effect.logInfo(['Effect ran at', timestamp])
      return `Effect ran at ${timestamp} then returned this string`
    })

    void RuntimeClient.runPromise(program).then((message) => {
      window.alert(message)
      closeCmd()
    })
  }, [closeCmd])

  return {
    resetUIState,
    resetAudioPlayer,
    resetAll,
    runEffectExample
  }
}
