<script lang="ts">
  import { text, type PublicRecord } from '@/lib/public-content'

  let {
    creator,
    createdAt,
    interactive = true
  }: { creator: PublicRecord | null; createdAt: string; interactive?: boolean } = $props()

  const username = $derived(text(creator?.username))

  const name = $derived(text(creator?.name, 'goosebumps.fm'))

  const href = $derived(interactive && username ? `/profile/${username}` : undefined)

  const image = $derived(
    text(creator?.image, 'https://d20tmfka7s58bt.cloudfront.net/gb-default.png')
  )

  const date = $derived(
    createdAt
      ? new Date(createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : ''
  )
</script>

<div class="flex min-w-0 items-center gap-3">
  <a
    {href}
    aria-label={href ? `${name}'s profile` : undefined}
    class="shrink-0 overflow-hidden rounded-sm ring-1 ring-border/60 transition-transform hover:scale-[1.02]">
    <img src={image} alt={`${name}'s avatar`} class="size-10 object-cover" loading="lazy" />
  </a>
  <div class="min-w-0 leading-tight">
    <a {href} class="block truncate font-bold text-foreground hover:underline">{name}</a>
    <div class="flex items-center gap-1.5 truncate text-base text-muted-foreground">
      {#if username}<a {href} class="truncate hover:text-foreground hover:underline">@{username}</a>{/if}
      {#if username && date}<span aria-hidden="true" class="text-muted-foreground/50">·</span>{/if}
      {#if date}<time class="shrink-0 font-mono text-xs text-muted-foreground/70" datetime={createdAt}>{date}</time>{/if}
    </div>
  </div>
</div>
