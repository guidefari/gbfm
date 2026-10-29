import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

export function useReaderReducedMotion() {
  const [reduced, setReduced] = useState(true)

  useEffect(() => {
    let active = true
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (active) setReduced(value)
      },
      () => {},
    )

    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  return reduced
}
