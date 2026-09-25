<script lang="ts">
  import type { LayoutProps } from './$types'
  import '@/styles/main.css'
  import { dev } from '$app/env'
  import { onNavigate } from '$app/navigation'
  import BrowserTelemetry from '@/lib/components/shell/BrowserTelemetry.svelte'
  import FpsMeter from '@/lib/components/shell/FpsMeter.svelte'
  import GlobalNav from '@/lib/components/shell/GlobalNav.svelte'
  import NavigationProgress from '@/lib/components/shell/NavigationProgress.svelte'
  import PlayerBar from '@/lib/components/shell/PlayerBar.svelte'
  import { createPlayerContext } from '@/lib/player/context'

  let { data, children }: LayoutProps = $props()
  createPlayerContext()

  onNavigate((navigation) => {
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return

    return new Promise<void>((resolve) => {
      document.startViewTransition(async () => {
        resolve()
        await navigation.complete
      })
    })
  })
</script>

<svelte:head>
  <meta name="theme-color" content="#080d0b" />
</svelte:head>

<div class="grid h-dvh w-full grid-cols-1 bg-background">
  <div class="relative flex h-dvh min-w-0 flex-col overflow-hidden">
    <main
      id="main-scroll-container"
      tabindex="-1"
      style="overflow-anchor: none"
      class="h-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom))] focus:outline-none lg:pb-12 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      {@render children()}
    </main>

    <GlobalNav principal={data.principal} />
  </div>
</div>

<PlayerBar />
<NavigationProgress />
<BrowserTelemetry />
{#if dev}<FpsMeter />{/if}
