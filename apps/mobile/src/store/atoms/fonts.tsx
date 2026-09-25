import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { Effect } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { type PropsWithChildren, useEffect, useRef } from 'react'

import jetBrainsMono from '../../../assets/fonts/JetBrainsMono-Regular.ttf'
import jetBrainsMonoSemiBold from '../../../assets/fonts/JetBrainsMono-SemiBold.ttf'

export const fontsReadyAtom = Atom.make<boolean>(false).pipe(Atom.keepAlive)

const hideSplash = Effect.promise(() => SplashScreen.hideAsync())

export const splashHideAtom = Atom.make(hideSplash)

const fontMap: Parameters<typeof useFonts>[0] = {
  JetBrainsMono: jetBrainsMono,
  'JetBrainsMono-SemiBold': jetBrainsMonoSemiBold,
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
