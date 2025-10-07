import { useTheme } from '@/components/ThemeProvider'

export const useThemeActions = (closeCmd: () => void) => {
  const { setTheme } = useTheme()

  const setLight = () => {
    setTheme('light')
    closeCmd()
  }

  const setDark = () => {
    setTheme('dark')
    closeCmd()
  }

  const setSystem = () => {
    setTheme('system')
    closeCmd()
  }

  return {
    setLight,
    setDark,
    setSystem
  }
}
