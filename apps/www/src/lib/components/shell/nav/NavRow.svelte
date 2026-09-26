<script lang="ts">
  import { page } from '$app/state'
  import { Check } from 'lucide-svelte'
  import { isPathActive, type NavItem } from './nav-config'
  import { navIcons } from './nav-icons'

  let { item }: { item: NavItem } = $props()

  const Icon = $derived(navIcons[item.icon])

  let copied = $state(false)

  const row =
    'group flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-base font-medium text-foreground no-underline transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-muted aria-[current=page]:text-highlight'

  const iconClass = 'size-5 shrink-0 transition-all group-hover:scale-110'

  const copyLink = async () => {
    const copiedOk = await navigator.clipboard
      .writeText(new URL(item.href, page.url.origin).toString())
      .then(() => true)
      .catch(() => false)

    if (!copiedOk) return
    copied = true
    setTimeout(() => (copied = false), 1234)
  }
</script>

{#if item.copy}
  <button type="button" class={row} onclick={copyLink}>
    {#if copied}<Check class={iconClass} />{:else}<Icon class={iconClass} />{/if}
    <span class="min-w-0 flex-1 truncate">{copied ? 'RSS link copied' : item.label}</span>
  </button>
{:else}
  <a
    href={item.href}
    target={item.external ? '_blank' : undefined}
    rel={item.external ? 'noreferrer' : undefined}
    aria-current={!item.external && isPathActive(page.url.pathname, item) ? 'page' : undefined}
    class={row}
  >
    <Icon class={iconClass} />
    <span class="min-w-0 flex-1 truncate">{item.label}</span>
  </a>
{/if}
