<script lang="ts">
  import { page } from '$app/state'
  import { BookOpen, Disc3, Menu, Pause, Play, Search } from 'lucide-svelte'
  import { onMount } from 'svelte'
  import { isPathActive } from './nav-config'
  import { getPlayerContext } from '@/lib/player/context'
  import { DEFAULT_IMAGE_URL } from '@/lib/constants'
  import type { NowPlaying } from './now-playing'

  let { player, onSearch }: { player: NowPlaying | null; onSearch: () => void } = $props()

  const controls = getPlayerContext()

  let menuOpen = $state(false)

  onMount(() => {
    const menu = document.getElementById('mobile-menu')

    const sync = (event: Event) => {
      if (event instanceof ToggleEvent) menuOpen = event.newState === 'open'
    }

    menu?.addEventListener('toggle', sync)

    return () => menu?.removeEventListener('toggle', sync)
  })

  const tab =
    'relative flex h-full min-w-0 flex-1 items-center justify-center text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-[current=page]:text-highlight'

  const current = (href: string): 'page' | undefined =>
    isPathActive(page.url.pathname, { href }) ? 'page' : undefined
</script>

<div class="grid h-11 grid-cols-5 lg:hidden">
  {#if player}
    <button
      type="button"
      aria-label="Now playing"
      class={[tab, 'text-foreground']}
      onclick={() => controls.fullscreen.set(true)}
    >
      <span
        class="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border"
      >
        <img src={player.thumbnailUrl || DEFAULT_IMAGE_URL} alt="" class="size-full object-cover" />
        <span class="absolute inset-0 flex items-center justify-center bg-background/40">
          {#if player.playing}<Pause class="size-3 text-white" fill="currentColor" />{:else}<Play
              class="size-3 text-white"
              fill="currentColor"
            />{/if}
        </span>
      </span>
    </button>
  {:else}
    <a href="/shows" aria-label="Now playing" class={tab}
      ><Disc3 class="size-5" strokeWidth={1.75} /></a
    >
  {/if}
  <a href="/shows" aria-label="Shows" aria-current={current('/shows')} class={tab}
    ><Disc3 class="size-5" strokeWidth={1.75} /></a
  >
  <a href="/editorial" aria-label="Editorial" aria-current={current('/editorial')} class={tab}
    ><BookOpen class="size-5" strokeWidth={1.75} /></a
  >
  <button type="button" aria-label="Search" class={tab} onclick={onSearch}
    ><Search class="size-5" strokeWidth={1.75} /></button
  >
  <button
    type="button"
    aria-label="Menu"
    aria-haspopup="dialog"
    aria-expanded={menuOpen}
    popovertarget="mobile-menu"
    class={[tab, menuOpen && 'text-highlight']}><Menu class="size-5" strokeWidth={1.75} /></button
  >
</div>
