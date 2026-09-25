<script lang="ts">
  import { goto } from '$app/navigation'
  import { SearchResults } from '@gbfm/api/search'
  import { Option, Schema } from 'effect'
  import { Search, X } from 'lucide-svelte'
  import { searchResultHref, searchResultLabel } from './search-result-href'

  let dialog = $state<HTMLDialogElement>()

  let input = $state<HTMLInputElement>()

  let query = $state('')

  let results = $state<SearchResults | null>(null)

  let pending = $state(false)

  let failed = $state(false)

  const groups = [
    { key: 'shows', label: 'Shows' },
    { key: 'audio', label: 'Mixes' },
    { key: 'posts', label: 'Posts' }
  ] as const

  const linkable = $derived.by(() => {
    const current = results

    if (!current) return []

    return groups.flatMap((group) =>
          current[group.key].flatMap((result) => {
            const href = searchResultHref(result)

            return href ? [{ group: group.key, result, href }] : []
          })
        )
  })

  export const open = () => {
    dialog?.showModal()
    input?.focus()
  }

  export const close = () => dialog?.close()

  $effect(() => {
    const value = query.trim()

    if (!value) {
      results = null
      pending = false

      return
    }

    pending = true
    failed = false
    const controller = new AbortController()

    const timer = setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(value)}&limit=8`, { signal: controller.signal }).catch(() => null)

      if (controller.signal.aborted) return
      const json: unknown = response?.ok ? await response.json().catch(() => null) : null
      results = Option.getOrNull(Schema.decodeUnknownOption(SearchResults)(json))
      failed = results === null
      pending = false
    }, 200)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  })

  const submit = () => {
    const first = linkable[0]

    if (first) void goto(first.href)
  }

  const reset = () => {
    query = ''
    results = null
  }
</script>

<dialog bind:this={dialog} onclose={reset} onclick={(event) => { if (event.target === dialog) close() }} aria-label="Search" class="m-0 mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl rounded-sm border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/70">
  <form role="search" onsubmit={(event) => { event.preventDefault(); submit() }} class="flex items-center gap-2 border-b border-border px-3">
    <Search size={16} class="shrink-0 text-muted-foreground" />
    <input bind:this={input} bind:value={query} placeholder="Search shows, mixes, tweets, editorial…" aria-label="Search query" autocomplete="off" class="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70" />
    <button type="button" aria-label="Close search" onclick={close} class="grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"><X size={16} /></button>
  </form>
  {#if query.trim()}
    <div class="max-h-[60vh] overflow-y-auto">
      {#if pending && !results}
        <p class="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
      {:else if failed}
        <p class="px-4 py-3 text-sm text-destructive">Search failed. Try again.</p>
      {:else if results && linkable.length === 0}
        <p class="px-4 py-3 text-sm text-muted-foreground">No matches for “{query.trim()}”</p>
      {:else if results}
        {#each groups as group (group.key)}
          {@const items = linkable.filter((entry) => entry.group === group.key)}
          {#if items.length > 0}
            <section>
              <h3 class="bg-muted/40 px-4 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground">{group.label}</h3>
              {#each items as { result, href } (result.id)}
                <a {href} class="flex items-center gap-3 border-b border-border/30 px-4 py-2 no-underline last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                  {#if result.thumbnailUrl}<img src={result.thumbnailUrl} alt="" class="size-8 shrink-0 rounded-sm object-cover" />{/if}
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm text-foreground">{result.title || result.description?.slice(0, 80) || '(untitled)'}</span>
                    {#if result.description && result.title}<span class="block truncate text-xs text-muted-foreground">{result.description}</span>{/if}
                  </span>
                  <span class="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{searchResultLabel(result.type)}</span>
                </a>
              {/each}
            </section>
          {/if}
        {/each}
      {/if}
    </div>
  {:else}
    <p class="px-4 py-3 text-xs text-muted-foreground">Press Enter to open the top result. <kbd class="font-mono">Esc</kbd> to close.</p>
  {/if}
</dialog>
