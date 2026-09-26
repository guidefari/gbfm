<script lang="ts">
  import { afterNavigate } from '$app/navigation'
  import type { Principal } from '@/lib/auth/principal'
  import { onMount } from 'svelte'
  import DesktopBar from './nav/DesktopBar.svelte'
  import MenuSheet from './nav/MenuSheet.svelte'
  import MobileTabBar from './nav/MobileTabBar.svelte'
  import SearchDialog from './nav/SearchDialog.svelte'
  import { getPlayerContext } from '@/lib/player/context'
  import { toNowPlaying } from './nav/now-playing'

  let { principal }: { principal: Principal } = $props()

  const snapshot = getPlayerContext().snapshot

  const player = $derived(toNowPlaying($snapshot))

  let search = $state<SearchDialog>()

  const openSearch = () => {
    document.getElementById('mobile-menu')?.hidePopover()
    search?.open()
  }

  const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)

  afterNavigate(() => {
    document.getElementById('mobile-menu')?.hidePopover()
    document.getElementById('account-menu')?.hidePopover()
    search?.close()
  })

  onMount(() => {
    const hotkeys = (event: KeyboardEvent) => {
      const commandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'

      if (!commandK && (event.key !== '/' || isTyping(event.target))) return
      event.preventDefault()
      event.stopPropagation()
      openSearch()
    }

    window.addEventListener('keydown', hotkeys, { capture: true })

    return () => {
      window.removeEventListener('keydown', hotkeys, { capture: true })
    }
  })
</script>

<nav
  aria-label="Primary"
  class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:h-12 lg:border-t-2 lg:border-foreground lg:bg-background/95 lg:pb-0 lg:backdrop-blur"
>
  {#if player}<div class="absolute inset-x-0 top-0 hidden h-[3px] bg-border/60 lg:block">
      <div
        class="h-full bg-highlight shadow-[0_0_6px_var(--highlight)] transition-[width] duration-300 ease-linear"
        style={`width:${player.progress}%`}
      ></div>
    </div>{/if}
  <MobileTabBar {player} onSearch={openSearch} />
  <DesktopBar {principal} {player} onSearch={openSearch} />
</nav>

<MenuSheet {principal} />
<SearchDialog bind:this={search} />
