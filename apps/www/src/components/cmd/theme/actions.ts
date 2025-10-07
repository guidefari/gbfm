import { useTheme } from '@/components/ThemeProvider'

export const useThemeActions = (_closeCmd: () => void) => {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    const themeOrder: Array<'light' | 'dark' | 'system'> = [
      'light',
      'dark',
      'system'
    ]
    const currentIndex = themeOrder.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themeOrder.length
    setTheme(themeOrder[nextIndex])
  }

  return {
    cycleTheme,
    currentTheme: theme
  }
}
