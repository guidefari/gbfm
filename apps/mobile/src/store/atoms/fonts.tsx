import * as Atom from 'effect/unstable/reactivity/Atom'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { type PropsWithChildren, useEffect, useRef } from 'react'
import { Effect } from 'effect'

export const fontsReadyAtom = Atom.make<boolean>(false).pipe(Atom.keepAlive)

const hideSplash = Effect.promise(() => SplashScreen.hideAsync())

export const splashHideAtom = Atom.make(hideSplash)

const fontMap: Parameters<typeof useFonts>[0] = {
  JetBrainsMono: require('../../../assets/fonts/JetBrainsMono-Regular.ttf'),
  'JetBrainsMono-SemiBold': require('../../../assets/fonts/JetBrainsMono-SemiBold.ttf')
}

export function FontsLoadedBridge({ children }: PropsWithChildren) {
  const [loaded] = useFonts(fontMap)
  const setReady = useAtomSet(fontsReadyAtom)
  const lastSyncedRef = useRef(false)

  useEffect(() => {
    if (loaded && !lastSyncedRef.current) {
      lastSyncedRef.current = true
      setReady(true)
    }
  }, [loaded, setReady])

  return <>{children}</>
}

export function useFontsReady() {
  return useAtomValue(fontsReadyAtom)
}
