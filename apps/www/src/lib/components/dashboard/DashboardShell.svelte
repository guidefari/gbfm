<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Principal } from '@/lib/auth/principal'

  let { principal, children }: { principal: Principal; children: Snippet } = $props()

  const isPublisher = (role: 'user' | 'creator' | 'editor' | 'admin') => role !== 'user'

  const member = [
    ['/dashboard', 'Home'],
    ['/dashboard/profile', 'Profile'],
    ['/dashboard/appearance', 'Appearance'],
    ['/dashboard/player', 'Player'],
    ['/dashboard/integrations', 'Integrations'],
    ['/dashboard/email', 'Email'],
  ]

  const creator = [
    ['/dashboard/content/mixes', 'My mixes'],
    ['/dashboard/content/tweets', 'My tweets'],
    ['/dashboard/content/editorial', 'My editorial'],
  ]

  const admin = [
    ['/dashboard/admin', 'Admin'],
    ['/dashboard/overview', 'Overview'],
    ['/dashboard/users', 'Users'],
    ['/dashboard/sessions', 'Sessions'],
    ['/dashboard/shows', 'Shows'],
    ['/dashboard/music', 'Music'],
    ['/dashboard/playlists', 'Playlists'],
    ['/dashboard/search', 'Search'],
    ['/dashboard/newsletter', 'Newsletter'],
    ['/dashboard/email-logs', 'Email logs'],
    ['/dashboard/frontend-errors', 'Frontend errors'],
    ['/dashboard/all/mixes', 'All content'],
  ]
</script>

<div class="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-7xl md:grid-cols-[15rem_1fr]">
  <aside class="border-b p-4 md:border-r md:border-b-0">
    <a class="mb-4 block text-lg font-black no-underline" href="/dashboard">Dashboard</a>
    <nav class="flex gap-2 overflow-x-auto md:flex-col md:gap-0" aria-label="Dashboard">
      {#each member as item}<a
          class="whitespace-nowrap rounded px-3 py-2 text-sm no-underline hover:bg-muted md:py-1"
          href={item[0]}>{item[1]}</a
        >{/each}
      {#if principal._tag === 'Authenticated' && isPublisher(principal.role)}
        <p class="mt-3 hidden px-3 text-xs font-bold uppercase text-muted-foreground md:block">
          Publishing
        </p>
        {#each creator as item}<a
            class="whitespace-nowrap rounded px-3 py-2 text-sm no-underline hover:bg-muted md:py-1"
            href={item[0]}>{item[1]}</a
          >{/each}
      {/if}
      {#if principal._tag === 'Authenticated' && principal.role === 'admin'}
        <p class="mt-3 hidden px-3 text-xs font-bold uppercase text-muted-foreground md:block">
          Operations
        </p>
        {#each admin as item}<a
            class="whitespace-nowrap rounded px-3 py-2 text-sm no-underline hover:bg-muted md:py-1"
            href={item[0]}>{item[1]}</a
          >{/each}
      {/if}
    </nav>
  </aside>
  <section class="min-w-0 p-4 sm:p-6 lg:p-10">{@render children()}</section>
</div>
