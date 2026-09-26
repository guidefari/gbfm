<script lang="ts">
  let {
    title,
    description,
    canonical,
    image,
  }: { title: string; description: string; canonical: string; image?: string } = $props()

  const fullTitle = $derived(title.includes('goosebumps.fm') ? title : `${title} | goosebumps.fm`)
</script>

<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={`https://goosebumps.fm${canonical}`} />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={`https://goosebumps.fm${canonical}`} />
  {#if image}<meta property="og:image" content={image} />{/if}
</svelte:head>
