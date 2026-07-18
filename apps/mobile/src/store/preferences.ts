import { Atom, useAtomSet, useAtomValue } from '@gbfm/mobile-state'

export type ColorSchemePreference = 'system' | 'light' | 'dark'

const colorSchemePreference = Atom.make<ColorSchemePreference>('system')

export const useColorSchemePreference = () => useAtomValue(colorSchemePreference)

export const useSetColorSchemePreference = () => useAtomSet(colorSchemePreference)
