<script lang="ts">
  import { onMount } from 'svelte'

  type Theme = 'light' | 'dark' | 'system'

  const options: ReadonlyArray<{ value: Theme; title: string; description: string }> = [
    { value: 'light', title: 'Light', description: 'Always use the light interface' },
    { value: 'dark', title: 'Dark', description: 'Always use the dark interface' },
    { value: 'system', title: 'System', description: 'Follow your device preference' }
  ]

  let theme = $state<Theme>('system')

  function applyTheme(value: Theme) {
    const resolved =
      value === 'system'
        ? matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : value

    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(resolved)
    document.documentElement.dataset.theme = resolved
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      resolved === 'dark' ? '#16415a' : '#e8eef7'
    )
  }

  function setTheme(value: Theme) {
    theme = value
    localStorage.setItem('vite-ui-theme', value)
    applyTheme(value)
  }

  onMount(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const saved = localStorage.getItem('vite-ui-theme')
    setTheme(saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system')

    const handleChange = () => {
      if (theme === 'system') applyTheme('system')
    }

    media.addEventListener('change', handleChange)

    return () => media.removeEventListener('change', handleChange)
  })
</script>

<div class="space-y-8">
  <div class="space-y-1">
    <h2 class="text-base font-bold tracking-widest text-muted-foreground">Appearance</h2>
    <p class="text-xs font-medium tracking-wider text-muted-foreground">Choose how gbfm looks on this device</p>
  </div>
  <div class="flex flex-col gap-6 md:flex-row">
    {#each options as option}
      <button type="button" aria-pressed={theme === option.value} onclick={() => setTheme(option.value)} class:border-primary={theme === option.value} class:bg-muted={theme === option.value} class:text-foreground={theme === option.value} class="relative flex flex-1 flex-col gap-2 rounded-none border-2 border-border p-6 text-left text-muted-foreground transition-all duration-300 hover:border-primary/50">
        {#if theme === option.value}<span class="absolute right-4 top-4 text-primary" aria-hidden="true">✓</span>{/if}
        <span class="text-base font-bold tracking-widest">{option.title}</span>
        <span class="text-xs font-medium leading-relaxed tracking-wider opacity-70">{option.description}</span>
      </button>
    {/each}
  </div>
</div>
