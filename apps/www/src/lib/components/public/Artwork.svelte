<script lang="ts">
  let { src, alt, square = true }: { src?: string; alt: string; square?: boolean } = $props()
</script>

{#if src}
  <img
    {src}
    {alt}
    loading="lazy"
    class:aspect-square={square}
    class="w-full border border-border object-cover" />
{:else}
  <div class:aspect-square={square} class="flex w-full items-center justify-center bg-muted text-3xl font-black" aria-hidden="true">
    {alt.slice(0, 1)}
  </div>
{/if}
