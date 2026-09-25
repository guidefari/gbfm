<script lang="ts">
  import { page } from '$app/state'
  import type { Principal } from '@/lib/auth/principal'
  import { LayoutDashboard, LogOut } from 'lucide-svelte'
  import NavRow from './NavRow.svelte'
  import { navSections, signInHref } from './nav-config'
  import { signOut } from './sign-out'

  let { principal }: { principal: Principal } = $props()

  const create = $derived(navSections(principal).create)
</script>

{#if principal._tag === 'Authenticated'}
  <button type="button" aria-label="Account menu" popovertarget="account-menu" class="grid size-7 shrink-0 place-items-center overflow-hidden rounded-sm border border-border bg-muted text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    {#if principal.imageUrl}<img src={principal.imageUrl} alt="" class="size-full object-cover" />{:else}{principal.name[0] ?? '?'}{/if}
  </button>
  <div id="account-menu" popover="auto" class="fixed bottom-14 left-auto right-4 top-auto m-0 w-60 rounded-sm border border-border bg-background p-1 text-foreground shadow-xl">
    <div class="border-b border-border px-3 py-2">
      <strong class="block truncate text-sm">{principal.name}</strong>
      <span class="block truncate text-xs text-muted-foreground">{principal.username ? `@${principal.username}` : principal.email}</span>
    </div>
    <div class="py-1">
      <a href="/dashboard" class="flex items-center gap-3 rounded-sm px-3 py-2 text-sm no-underline hover:bg-muted/60"><LayoutDashboard size={16} />Dashboard</a>
    </div>
    {#if create.length > 0}
      <div class="border-t border-border py-1 text-sm">
        {#each create as item (item.id)}<NavRow {item} />{/each}
      </div>
    {/if}
    <div class="border-t border-border pt-1">
      <button type="button" class="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted/60" onclick={() => void signOut()}><LogOut size={16} />Log out</button>
    </div>
  </div>
{:else}
  <a href={signInHref(page.url.pathname)} class="shrink-0 text-xs font-semibold text-highlight no-underline hover:opacity-90">Log in</a>
{/if}
