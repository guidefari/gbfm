<script lang="ts">
  import { onMount } from 'svelte'; import Page from '@/lib/components/dashboard/Page.svelte'
  type Theme = 'light'|'dark'|'system'; const options: ReadonlyArray<Theme>=['light','dark','system']; let theme=$state<Theme>('system')
  function apply(value: Theme){theme=value;localStorage.setItem('theme',value);const dark=value==='dark'||(value==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark)}
  onMount(()=>{const saved=localStorage.getItem('theme');apply(saved==='light'||saved==='dark'?saved:'system')})
</script>
<Page title="Appearance" description="Choose how goosebumps.fm looks on this device."><div class="grid max-w-2xl gap-3 sm:grid-cols-3">{#each options as option}<button class:border-foreground={theme===option} class="rounded border-2 p-6 text-left capitalize" onclick={()=>apply(option)}><strong>{option}</strong><span class="mt-2 block text-sm text-muted-foreground">{option==='system'?'Follow your device preference':`Always use the ${option} interface`}</span></button>{/each}</div><p class="text-sm text-muted-foreground" aria-live="polite">Current theme: {theme}.</p></Page>
