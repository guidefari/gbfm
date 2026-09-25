<script lang="ts">
  import { page } from '$app/state'
  import { BookOpen, House, Menu, Pause, Play, Radio, Search } from 'lucide-svelte'
  import { isPathActive } from './nav-config'
  import { getPlayerContext } from '@/lib/player/context'
  import type { NowPlaying } from './now-playing'

  let { player, onSearch }: { player: NowPlaying | null; onSearch: () => void } = $props()
  const controls = getPlayerContext()
  const tab = 'flex min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground no-underline transition-colors hover:text-foreground aria-[current=page]:text-highlight'
</script>

<div class="grid h-14 grid-cols-5 lg:hidden">
  {#if player}
    <button type="button" aria-label="Now playing" class={[tab, 'text-foreground']} onclick={() => controls.fullscreen.set(true)}>
      <span class="relative size-6 overflow-hidden rounded-sm border border-border">
        {#if player.thumbnailUrl}<img src={player.thumbnailUrl} alt="" class="size-full object-cover" />{/if}
        <span class="absolute inset-0 grid place-items-center bg-black/40 text-white">{#if player.playing}<Pause size={10} fill="currentColor" />{:else}<Play size={10} fill="currentColor" />{/if}</span>
      </span>
      <span>Playing</span>
    </button>
  {:else}
    <a href="/" aria-current={isPathActive(page.url.pathname, { href: '/' }) ? 'page' : undefined} class={tab}><House size={20} strokeWidth={1.75} /><span>Home</span></a>
  {/if}
  <a href="/shows" aria-current={isPathActive(page.url.pathname, { href: '/shows' }) ? 'page' : undefined} class={tab}><Radio size={20} strokeWidth={1.75} /><span>Shows</span></a>
  <a href="/editorial" aria-current={isPathActive(page.url.pathname, { href: '/editorial' }) ? 'page' : undefined} class={tab}><BookOpen size={20} strokeWidth={1.75} /><span>Editorial</span></a>
  <button type="button" class={tab} onclick={onSearch}><Search size={20} strokeWidth={1.75} /><span>Search</span></button>
  <button type="button" aria-haspopup="dialog" popovertarget="mobile-menu" class={tab}><Menu size={20} strokeWidth={1.75} /><span>Menu</span></button>
</div>
