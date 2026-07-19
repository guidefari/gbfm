import { useAtomSet, useAtomValue } from '@effect/atom-react'
import * as Atom from 'effect/unstable/reactivity/Atom'

export type ColorSchemePreference = 'system' | 'light' | 'dark'

const colorSchemePreference = Atom.make<ColorSchemePreference>('system').pipe(Atom.keepAlive)

export const useColorSchemePreference = () => useAtomValue(colorSchemePreference)

export const useSetColorSchemePreference = () => useAtomSet(colorSchemePreference)
