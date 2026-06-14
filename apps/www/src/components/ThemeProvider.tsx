import { dark, light, studio } from '@gbfm/theme'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

const themeColors: Record<string, string> = {
  dark: dark.backgroundHex,
  light: light.backgroundHex,
  studio: studio.backgroundHex
}

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: 'dark' | 'light'
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'dark',
  setTheme: () => null
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

function parseTheme(value: string | null): Theme | null {
  if (value === 'dark' || value === 'light' || value === 'system') {
    return value
  }

  return null
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => parseTheme(localStorage.getItem(storageKey)) || defaultTheme
  )

  const getSystemTheme = (): 'dark' | 'light' =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(() =>
    theme === 'system' ? getSystemTheme() : theme
  )

  useEffect(() => {
    const root = window.document.documentElement
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')

    const updateTheme = () => {
      const currentTheme = theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : theme
      root.classList.remove('light', 'dark')
      root.classList.add(currentTheme)
      root.setAttribute('data-theme', currentTheme)
      setResolvedTheme(currentTheme)

      const metaThemeColor = document.querySelector('meta[name="theme-color"]')
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', themeColors[currentTheme])
      }
    }

    updateTheme()

    const handleChange = () => {
      if (theme === 'system') {
        updateTheme()
      }
    }

    systemTheme.addEventListener('change', handleChange)

    return () => {
      systemTheme.removeEventListener('change', handleChange)
    }
  }, [theme])

  const value = {
    theme,
    resolvedTheme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    }
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
