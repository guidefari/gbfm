<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import type { Principal } from '@/lib/auth/principal'
  import { Option, Schema } from 'effect'
  import { onMount } from 'svelte'

  const PlayerChrome = Schema.Struct({
    id: Schema.String,
    playing: Schema.Boolean,
    title: Schema.String,
    thumbnailUrl: Schema.NullOr(Schema.String),
    progress: Schema.Number
  })
  type PlayerChrome = typeof PlayerChrome.Type

  let { principal }: { principal: Principal } = $props()
  let searchOpen = $state(false)
  let query = $state('')
  let player = $state<PlayerChrome | null>(null)

  const desktopLinks = [
    { href: '/tweets', label: 'Tweets' },
    { href: '/shows', label: 'Radio Shows' },
    { href: '/editorial', label: 'Editorial' },
    { href: '/mixes', label: 'Mixes' }
  ]
  const isActive = (href: string) => {
    const path = page.url.pathname
    if (href === '/tweets') return path === href || path.startsWith('/tweet/')
    return path === href || path.startsWith(`${href}/`)
  }
  const dispatchPlayerAction = (action: 'fullscreen' | 'toggle') =>
    window.dispatchEvent(new CustomEvent(`gbfm:player-${action}`))
  const submit = () => {
    const value = query.trim()
    if (!value) return
    searchOpen = false
    void goto(`/tweets?q=${encodeURIComponent(value)}`)
  }

  onMount(() => {
    const updatePlayer = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      player = Option.getOrNull(Schema.decodeUnknownOption(PlayerChrome)(event.detail))
    }
    window.addEventListener('gbfm:player-chrome', updatePlayer)
    window.dispatchEvent(new CustomEvent('gbfm:player-chrome-request'))
    return () => {
      window.removeEventListener('gbfm:player-chrome', updatePlayer)
    }
  })
</script>

<nav aria-label="Primary" class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:h-12 lg:border-t-2 lg:border-foreground lg:pb-0">
  {#if player}<div class="absolute inset-x-0 top-0 h-[3px] bg-border/60"><div class="h-full bg-highlight shadow-[0_0_6px_var(--highlight)]" style={`width:${player.progress}%`}></div></div>{/if}

  <div class="grid h-11 grid-cols-5 lg:hidden">
    {#if player}
      <button type="button" aria-label="Now playing" class="flex items-center justify-center" onclick={() => dispatchPlayerAction('fullscreen')}>
        <span class="relative size-7 overflow-hidden rounded-sm border border-border">
          {#if player.thumbnailUrl}<img src={player.thumbnailUrl} alt="" class="size-full object-cover" />{:else}<span class="grid size-full place-items-center">♪</span>{/if}
          <span class="absolute inset-0 grid place-items-center bg-black/35 text-xs text-white">{player.playing ? 'Ⅱ' : '▶'}</span>
        </span>
      </button>
    {:else}<a href="/tweets" aria-label="Tweets" class="grid place-items-center no-underline">♪</a>{/if}
    <a href="/shows" aria-label="Radio Shows" aria-current={isActive('/shows') ? 'page' : undefined} class="grid place-items-center text-lg no-underline aria-[current=page]:text-highlight">◉</a>
    <a href="/editorial" aria-label="Editorial" aria-current={isActive('/editorial') ? 'page' : undefined} class="grid place-items-center text-lg no-underline aria-[current=page]:text-highlight">▤</a>
    <button type="button" aria-label="Search" class="text-lg" onclick={() => (searchOpen = true)}>⌕</button>
    <button type="button" aria-label="Menu" aria-haspopup="dialog" popovertarget="mobile-menu" class="text-lg">☰</button>
  </div>

  <div class="hidden h-full items-center gap-4 px-4 lg:flex lg:pr-6">
    <a href="/" aria-label="goosebumps.fm home" class="shrink-0 font-black no-underline">gb<span class="text-highlight">fm</span></a>
    <div class="flex shrink-0 items-center gap-1">{#each desktopLinks as link}<a href={link.href} aria-current={isActive(link.href) ? 'page' : undefined} class="rounded-sm px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground no-underline hover:text-foreground aria-[current=page]:text-highlight">{link.label}</a>{/each}</div>
    <button type="button" aria-label="Search" class="grid size-7 place-items-center text-muted-foreground hover:text-foreground" onclick={() => (searchOpen = true)}>⌕</button>
    <span class="min-w-0 flex-1"></span>
    {#if player}<div class="flex min-w-0 max-w-56 items-center gap-2 border-r border-border pr-3"><button type="button" aria-label={player.playing ? 'Pause' : 'Play'} class="size-7 shrink-0 rounded-sm border border-border text-xs" onclick={() => dispatchPlayerAction('toggle')}>{player.playing ? 'Ⅱ' : '▶'}</button><button type="button" class="truncate text-left text-xs font-medium text-muted-foreground hover:text-foreground" onclick={() => dispatchPlayerAction('fullscreen')}>{player.title}</button></div>{/if}
    {#if principal._tag === 'Authenticated'}<a href="/dashboard" aria-label="Dashboard" class="flex size-7 items-center justify-center overflow-hidden rounded-sm border border-border bg-muted text-xs font-bold no-underline">{#if principal.imageUrl}<img src={principal.imageUrl} alt="" class="size-full object-cover" />{:else}{principal.name[0] ?? '?'}{/if}</a>{:else}<a href={`/auth/sign-in?redirect=${encodeURIComponent(page.url.pathname)}`} class="text-xs font-semibold text-highlight no-underline">Log in</a>{/if}
  </div>
</nav>

<div id="mobile-menu" popover="auto" role="dialog" aria-labelledby="menu-title" class="fixed inset-x-0 bottom-0 top-auto z-50 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-lg border-x-0 border-b-0 border-t border-border bg-background p-0 text-foreground backdrop:bg-black/60 lg:hidden">
  <header class="flex h-12 items-center justify-between border-b border-border px-4"><h2 id="menu-title" class="font-black">Menu</h2><button aria-label="Close menu" popovertarget="mobile-menu" popovertargetaction="hide" class="p-2 text-xl">×</button></header>
  <div class="grid gap-1 p-3"><p class="px-3 pt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Browse</p>{#each desktopLinks as link}<a href={link.href} aria-current={isActive(link.href) ? 'page' : undefined} class="rounded-sm px-3 py-2 font-semibold no-underline aria-[current=page]:bg-muted aria-[current=page]:text-highlight">{link.label}</a>{/each}<p class="px-3 pt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Follow</p><a href="/subscribe" class="rounded-sm px-3 py-2 font-semibold no-underline">Newsletter</a></div>
  <footer class="border-t border-border p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">{#if principal._tag === 'Authenticated'}<div class="mb-2 px-2"><strong class="block truncate">{principal.name}</strong><span class="block truncate text-xs text-muted-foreground">{principal.username ? `@${principal.username}` : principal.email}</span></div><a href="/dashboard" class="block rounded-sm bg-highlight px-3 py-2 text-center font-bold text-highlight-foreground no-underline">Dashboard</a>{:else}<a href={`/auth/sign-in?redirect=${encodeURIComponent(page.url.pathname)}`} class="block rounded-sm bg-highlight px-3 py-2 text-center font-bold text-highlight-foreground no-underline">Log in</a>{/if}</footer>
</div>

{#if searchOpen}<div class="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[15vh]" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) searchOpen = false }}><form role="search" onsubmit={(event) => { event.preventDefault(); submit() }} class="w-full max-w-xl border-2 border-foreground bg-background p-4"><div class="mb-3 flex justify-between"><strong>Search tweets</strong><button type="button" aria-label="Close search" onclick={() => (searchOpen = false)}>×</button></div><input bind:value={query} placeholder="Search posts…" aria-label="Search query" class="w-full border border-border bg-background px-3 py-3" /><button class="mt-3 w-full bg-highlight px-4 py-2 font-bold text-highlight-foreground">Search</button></form></div>{/if}
