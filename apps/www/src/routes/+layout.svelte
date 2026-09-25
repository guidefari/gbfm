<script lang="ts">
  import type { LayoutProps } from './$types'
  import '@/styles/main.css'
  import { dev } from '$app/env'
  import BrowserTelemetry from '@/lib/components/shell/BrowserTelemetry.svelte'
  import FpsMeter from '@/lib/components/shell/FpsMeter.svelte'
  import PlayerBar from '@/lib/components/shell/PlayerBar.svelte'

  let { data, children }: LayoutProps = $props()
</script>

<svelte:head>
  <meta name="theme-color" content="#080d0b" />
</svelte:head>

<div class="grid h-dvh w-full grid-cols-1 bg-background">
  <div class="relative flex h-dvh min-w-0 flex-col overflow-hidden">
    <main
      id="main-scroll-container"
      tabindex="-1"
      class="h-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background pb-16 focus:outline-none">
      {@render children()}
    </main>

    <nav
      aria-label="Primary"
      class="z-40 flex h-12 shrink-0 items-center gap-4 border-t-2 border-foreground bg-background/95 px-4 backdrop-blur">
      <a href="/" class="font-bold no-underline">gb<span class="text-highlight">fm</span></a>
      <a href="/tweets" class="text-xs font-semibold no-underline">Tweets</a>
      <a href="/shows" class="text-xs font-semibold no-underline">Radio Shows</a>
      <a href="/editorial" class="text-xs font-semibold no-underline">Editorial</a>
      <a href="/mixes" class="text-xs font-semibold no-underline">Mixes</a>
      <span class="flex-1"></span>
      {#if data.principal._tag === 'Authenticated'}
        <a href="/dashboard" class="text-xs font-semibold no-underline">{data.principal.name}</a>
      {:else}
        <a href="/auth/sign-in" class="text-xs font-semibold text-highlight no-underline">Log in</a>
      {/if}
    </nav>
  </div>
</div>

<PlayerBar />
<BrowserTelemetry />
{#if dev}<FpsMeter />{/if}
