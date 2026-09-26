<script lang="ts">
  import PublicHead from '@/lib/components/public/PublicHead.svelte'
</script>

<PublicHead
  title="Changelog"
  description="Latest goosebumps.fm release notes, updates and fixes."
  canonical="/changelog"
/>
<main class="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
  <section class="border border-border bg-background p-6">
    <h1 class="m-0 text-center text-4xl font-black sm:text-5xl">Changelog</h1>
    <p class="mt-4 text-muted-foreground">
      Latest release notes, updates and fixes from goosebumps.fm.
    </p>
  </section>
  <section class="border border-border p-6">
    <p>Release history is published with each goosebumps.fm update.</p>
    <a
      class="font-bold text-highlight"
      href="https://github.com/guidefari/gbfm/blob/prod/CHANGELOG.md"
      >Read the complete release history</a
    >
  </section>
</main>
