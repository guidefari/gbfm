<script lang="ts">
  import FeaturedMixHero from '@/lib/components/public/FeaturedMixHero.svelte'
  import type { PageProps } from './$types'
  let { data }: PageProps = $props()
</script>

<svelte:head>
  <title>goosebumps.fm — online community radio</title>
  <meta
    name="description"
    content="Independent radio, mixes, music writing and community from Johannesburg." />
  <link rel="canonical" href="https://goosebumps.fm/" />
</svelte:head>

<div class="flex min-h-full items-center justify-center px-6 py-8 lg:py-0">
  <div class="flex w-fit flex-col items-center gap-8 lg:flex-row lg:gap-12">
    <h1 class="my-0 w-fit shrink-0 text-right font-bold leading-[0.85] tracking-tight text-[min(12vw,4.5rem)] md:text-8xl lg:border-r-2 lg:border-foreground/30 lg:pr-12 lg:text-7xl xl:text-9xl">goosebumps.<br /><span class="text-highlight">fm</span></h1>
    <div class="flex w-full max-w-xs shrink-0 lg:w-72 xl:w-80"><FeaturedMixHero mix={data.items[0]} /></div>
  </div>
</div>
