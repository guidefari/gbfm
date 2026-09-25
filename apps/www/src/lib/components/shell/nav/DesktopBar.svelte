<script lang="ts">
  import { page } from '$app/state'
  import type { Principal } from '@/lib/auth/principal'
  import { Search } from 'lucide-svelte'
  import GoosebumpsLogo from '../GoosebumpsLogo.svelte'
  import AccountMenu from './AccountMenu.svelte'
  import NowPlayingChip from './NowPlayingChip.svelte'
  import { desktopNavItems, isPathActive } from './nav-config'
  import type { NowPlaying } from './now-playing'

  let { principal, player, onSearch }: { principal: Principal; player: NowPlaying | null; onSearch: () => void } = $props()
</script>

<div class="hidden h-full items-center gap-4 px-4 lg:flex lg:pr-6">
  <a href="/" aria-label="goosebumps.fm home" class="flex shrink-0 items-center text-foreground no-underline transition-colors hover:text-highlight"><GoosebumpsLogo class="h-5 w-auto shrink-0" /></a>
  <div class="flex shrink-0 items-center gap-1">
    {#each desktopNavItems as item (item.id)}
      <a href={item.href} aria-current={isPathActive(page.url.pathname, item) ? 'page' : undefined} class="rounded-sm px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground no-underline transition-colors hover:text-foreground aria-[current=page]:text-highlight">{item.label}</a>
    {/each}
  </div>
  <button type="button" onclick={onSearch} class="flex h-7 items-center gap-2 rounded-sm border border-border px-2 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground">
    <Search size={12} />
    <span>Search</span>
    <kbd class="font-mono text-[10px] opacity-70">⌘K</kbd>
  </button>
  <span class="min-w-0 flex-1"></span>
  <div class="flex min-w-0 items-center gap-3">
    {#if player}<NowPlayingChip {player} />{/if}
    <AccountMenu {principal} />
  </div>
</div>
