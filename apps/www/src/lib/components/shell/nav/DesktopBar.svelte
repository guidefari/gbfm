<script lang="ts">
  import { page } from '$app/state'
  import type { Principal } from '@/lib/auth/principal'
  import { Search } from 'lucide-svelte'
  import GoosebumpsLogo from '../GoosebumpsLogo.svelte'
  import AccountMenu from './AccountMenu.svelte'
  import NowPlayingChip from './NowPlayingChip.svelte'
  import { desktopNavItems, isPathActive } from './nav-config'
  import type { NowPlaying } from './now-playing'

  let {
    principal,
    player,
    onSearch,
  }: { principal: Principal; player: NowPlaying | null; onSearch: () => void } = $props()
</script>

<div class="hidden h-full items-center gap-4 pl-4 pr-6 lg:flex">
  <a
    href="/"
    aria-label="goosebumps.fm home"
    class="group flex shrink-0 items-center text-foreground no-underline transition-colors hover:text-highlight"
    ><GoosebumpsLogo class="h-5 w-auto shrink-0" /></a
  >
  <div class="flex shrink-0 items-center gap-1">
    {#each desktopNavItems as item (item.id)}
      <a
        href={item.href}
        aria-current={isPathActive(page.url.pathname, item) ? 'page' : undefined}
        class="shrink-0 rounded-sm px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:text-highlight"
        >{item.label}</a
      >
    {/each}
  </div>
  <button
    type="button"
    onclick={onSearch}
    aria-label="Search"
    class="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <Search class="size-3" />
  </button>
  <span class="min-w-0 flex-1"></span>
  <div class="flex shrink-0 items-center gap-3">
    {#if player}<NowPlayingChip {player} />{/if}
    <AccountMenu {principal} />
  </div>
</div>
