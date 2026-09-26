<script lang="ts">
  import Artwork from './Artwork.svelte'
  import ContentGrid from './ContentGrid.svelte'
  import PublicHead from './PublicHead.svelte'
  import PublicState from './PublicState.svelte'
  import { record, records, text, type PublicRecord } from '@/lib/public-content'

  let {
    item,
    failure,
    canonical,
  }: { item: PublicRecord | null; failure: string | null; canonical: string } = $props()

  const content = $derived(record(item?.content))

  const socialLinks = $derived(records(item?.socialLinks))

  const sections = $derived([
    {
      title: 'Mixes',
      items: records(content?.mixes),
      href: (entry: PublicRecord) => `/mixes/${entry.slug}`,
    },
    {
      title: 'Shows',
      items: records(content?.shows),
      href: (entry: PublicRecord) => `/shows/${entry.slug}`,
    },
    {
      title: 'Editorial',
      items: records(content?.editorials),
      href: (entry: PublicRecord) => `/editorial/${entry.slug}`,
    },
    {
      title: 'Tweets',
      items: records(content?.tweets),
      href: (entry: PublicRecord) => `/tweet/${entry.slug}`,
    },
  ])
</script>

<PublicHead
  title={text(item?.name, 'Profile')}
  description={text(item?.bio, `Public profile on goosebumps.fm.`)}
  {canonical}
  {...text(item?.image) ? { image: text(item?.image) } : {}}
/>
{#if failure || !item}
  <PublicState message={failure ?? 'This profile could not be found.'} error />
{:else}
  <div class="mx-auto flex max-w-7xl flex-col gap-8 p-4 lg:flex-row lg:p-8">
    <aside class="w-full shrink-0 lg:w-80">
      <div class="w-32">
        <Artwork
          {...text(item.image) ? { src: text(item.image) } : {}}
          alt={text(item.name, 'Profile')}
        />
      </div>
      <h1 class="mb-1 mt-4 text-3xl font-black">{text(item.name, 'Profile')}</h1>
      {#if text(item.username)}<p class="text-sm text-muted-foreground">
          @{text(item.username)}
        </p>{/if}
      {#if text(item.bio)}<p class="mt-4 whitespace-pre-wrap leading-6">{text(item.bio)}</p>{/if}
      {#if socialLinks.length}<nav
          aria-label="Social links"
          class="mt-6 flex flex-col border border-border"
        >
          {#each socialLinks as link}{#if text(link.url)}<a
                href={text(link.url)}
                target="_blank"
                rel="noopener noreferrer"
                class="border-b border-border px-3 py-2 text-sm font-bold last:border-0"
                >{text(link.platform, 'Website')} ↗</a
              >{/if}{/each}
        </nav>{/if}
    </aside>
    <main class="min-w-0 flex-1 divide-y divide-border">
      {#each sections as section}
        {#if section.items.length}<section class="py-6">
            <h2 class="mb-4 text-xl font-black text-highlight">{section.title}</h2>
            <ContentGrid items={section.items} href={section.href} />
          </section>{/if}
      {/each}
      {#if sections.every((section) => section.items.length === 0)}<PublicState
          message="No public content yet."
        />{/if}
    </main>
  </div>
{/if}
