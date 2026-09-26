<script lang="ts" module>
  export type JumpItem = {
    readonly key: string
    readonly label: string
    readonly href: string | null
    readonly current: boolean
    readonly total: number
    readonly unread: number
  }
</script>

<script lang="ts">
  import { ChevronDown } from 'lucide-svelte'

  let {
    id,
    label,
    title,
    items,
  }: { id: string; label: string; title: string; items: ReadonlyArray<JumpItem> } = $props()

  let trigger = $state<HTMLButtonElement>()

  let menu = $state<HTMLDivElement>()

  const MENU_WIDTH = 224

  const place = (event: Event) => {
    if (!(event instanceof ToggleEvent) || event.newState !== 'open' || !trigger || !menu) return
    const rect = trigger.getBoundingClientRect()
    menu.style.top = `${rect.bottom + 6}px`
    menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8))}px`
  }

  const close = () => menu?.hidePopover()
</script>

{#if items.length > 0}
  <button
    bind:this={trigger}
    type="button"
    popovertarget={id}
    aria-label={title}
    class="inline-flex min-h-7 items-center gap-0.5 rounded-sm px-1.5 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    {label}<ChevronDown class="size-3 text-muted-foreground" />
  </button>
  <div
    bind:this={menu}
    {id}
    popover="auto"
    onbeforetoggle={place}
    class="fixed m-0 max-h-[60dvh] w-56 overflow-y-auto rounded-sm border border-border bg-background p-1 font-mono text-xs text-foreground shadow-xl scrollbar-hide"
  >
    <p class="px-2 py-1.5 text-muted-foreground">{title}</p>
    {#each items as item (item.key)}
      {#if item.href}
        <a
          href={item.href}
          onclick={close}
          aria-current={item.current ? 'date' : undefined}
          class="flex items-center gap-2 rounded-sm px-2 py-1.5 no-underline transition-colors hover:bg-muted aria-[current=date]:bg-muted aria-[current=date]:text-highlight"
        >
          <span class="flex-1">{item.label}</span>
          {#if item.unread > 0 && item.unread < item.total}<span class="text-highlight"
              >{item.unread} new</span
            >{/if}
          <span class="w-8 text-right text-muted-foreground">{item.total}</span>
        </a>
      {:else}
        <span class="flex items-center gap-2 px-2 py-1.5 text-muted-foreground/50">
          <span class="flex-1">{item.label}</span>
          <span class="w-8 text-right">0</span>
        </span>
      {/if}
    {/each}
  </div>
{:else}
  <span class="px-1.5 text-foreground">{label}</span>
{/if}
