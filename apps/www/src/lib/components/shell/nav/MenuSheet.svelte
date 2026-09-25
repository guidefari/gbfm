<script lang="ts">
  import { page } from '$app/state'
  import type { Principal } from '@/lib/auth/principal'
  import { LayoutDashboard, LogIn, LogOut, X } from 'lucide-svelte'
  import NavRow from './NavRow.svelte'
  import { navSections, signInHref } from './nav-config'
  import { signOut } from './sign-out'

  let { principal }: { principal: Principal } = $props()

  const sections = $derived(navSections(principal))

  const row =
    'flex w-full items-center gap-3 rounded-sm px-3 py-2 text-base font-medium no-underline transition-colors hover:bg-muted/60'
</script>

<div
  id="mobile-menu"
  popover="auto"
  role="dialog"
  aria-labelledby="menu-title"
  class="fixed inset-x-0 bottom-0 top-auto z-50 m-0 flex max-h-[85dvh] w-full max-w-none flex-col overflow-hidden rounded-t-lg border-x-0 border-b-0 border-t border-border bg-background p-0 text-foreground backdrop:bg-black/60 sm:mx-auto sm:max-w-lg lg:hidden"
>
  <div class="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border"></div>
  <header class="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
    <h2 id="menu-title" class="text-base font-black tracking-tight">Menu</h2>
    <button
      aria-label="Close menu"
      popovertarget="mobile-menu"
      popovertargetaction="hide"
      class="grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      ><X size={16} /></button
    >
  </header>
  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
    <div class="flex flex-col gap-6">
      {#each [{ title: 'Browse', items: sections.browse }, { title: 'Create', items: sections.create }, { title: 'Follow', items: sections.follow }] as section (section.title)}
        {#if section.items.length > 0}
          <section class="flex flex-col gap-1">
            <h3 class="px-3 pb-1 text-xs font-semibold tracking-wider text-muted-foreground">
              {section.title}
            </h3>
            {#each section.items as item (item.id)}<NavRow {item} />{/each}
          </section>
        {/if}
      {/each}
    </div>
  </div>
  <footer class="shrink-0 border-t border-border p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
    {#if principal._tag === 'Authenticated'}
      <div class="mb-2 flex items-center gap-3 px-1">
        <span
          class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-sm border border-border bg-muted font-bold"
          >{#if principal.imageUrl}<img
              src={principal.imageUrl}
              alt=""
              class="size-full object-cover"
            />{:else}{principal.name[0] ?? '?'}{/if}</span
        >
        <span class="min-w-0 flex-1"
          ><strong class="block truncate">{principal.name}</strong><span
            class="block truncate text-xs text-muted-foreground"
            >{principal.username ? `@${principal.username}` : principal.email}</span
          ></span
        >
      </div>
      <a href="/dashboard" class={row}><LayoutDashboard size={18} strokeWidth={1.75} />Dashboard</a>
      <button type="button" class={[row, 'text-left']} onclick={() => void signOut()}
        ><LogOut size={18} strokeWidth={1.75} />Log out</button
      >
    {:else}
      <a
        href={signInHref(page.url.pathname)}
        class={[row, 'bg-highlight text-highlight-foreground hover:bg-highlight/90']}
        ><LogIn size={18} strokeWidth={1.75} />Log in</a
      >
    {/if}
  </footer>
</div>
