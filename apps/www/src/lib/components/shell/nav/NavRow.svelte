<script lang="ts">
  import { page } from '$app/state'
  import { isPathActive, type NavItem } from './nav-config'
  import { navIcons } from './nav-icons'

  let { item }: { item: NavItem } = $props()

  const Icon = $derived(navIcons[item.icon])
</script>

<a href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noreferrer' : undefined} aria-current={!item.external && isPathActive(page.url.pathname, item) ? 'page' : undefined} class="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-base font-medium text-foreground no-underline transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-muted aria-[current=page]:text-highlight">
  <Icon size={18} strokeWidth={1.75} class="shrink-0" />
  <span class="min-w-0 flex-1 truncate">{item.label}</span>
</a>
