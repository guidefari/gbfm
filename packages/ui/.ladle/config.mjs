const systemThemeScript = `<script>
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
  const updateTheme = () => {
    const theme = systemTheme.matches ? 'dark' : 'light'
    if (document.documentElement.dataset.theme !== theme) {
      document.documentElement.dataset.theme = theme
    }
  }

  const themeObserver = new MutationObserver(updateTheme)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })

  updateTheme()
  systemTheme.addEventListener('change', updateTheme)
</script>`

export default {
  stories: 'src/components/**/*.stories.tsx',
  viteConfig: './vite.config.ts',
  appendToHead: systemThemeScript,
  addons: {
    theme: {
      defaultState: 'auto'
    }
  }
}
