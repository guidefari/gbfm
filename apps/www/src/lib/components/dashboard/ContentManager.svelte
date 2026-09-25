<script lang="ts">
  import { Option, Schema } from 'effect'
  import { onMount } from 'svelte'
  import Page from './Page.svelte'
  import { dashboardCommand, dashboardJson, jsonRequest } from './api'

  const Item = Schema.Struct({
    id: Schema.String,
    title: Schema.NullOr(Schema.String),
    slug: Schema.String,
    draft: Schema.Boolean,
    createdAt: Schema.String,
    updatedAt: Schema.String
  })

  const Response = Schema.Struct({
    data: Schema.Array(Item),
    pagination: Schema.Struct({
      total: Schema.Number,
      limit: Schema.Number,
      offset: Schema.Number,
      hasMore: Schema.Boolean
    })
  })

  const Status = Schema.Literals(['all', 'draft', 'live'])

  let {
    title,
    description,
    contentType,
    scope = 'own'
  }: {
    title: string
    description: string
    contentType: 'mix' | 'micro' | 'post'
    scope?: 'own' | 'all'
  } = $props()

  type ItemValue = typeof Item.Type

  type StatusValue = typeof Status.Type

  let items = $state<ReadonlyArray<ItemValue>>([])

  let selected = $state<ReadonlyArray<string>>([])

  let offset = $state(0)

  let total = $state(0)

  let query = $state('')

  let status = $state<StatusValue>('all')

  let pending = $state(false)

  let message = $state('')

  const limit = 25

  const isAudio = $derived(contentType === 'mix')

  const actionBase = $derived(isAudio ? '/api/content/audio/mix' : '/api/content/posts')

  const endpoint = () => {
    const path = isAudio ? '/api/content/audio/mix/manage' : '/api/content/posts/manage'
    const parameters = new URLSearchParams({ limit: String(limit), offset: String(offset) })

    if (!isAudio) parameters.set('type', contentType)

    if (!isAudio && query.trim()) parameters.set('q', query.trim())

    if (!isAudio && status !== 'all') parameters.set('status', status)

    return `${path}?${parameters}`
  }

  async function load() {
    pending = true
    message = ''

    try {
      const response = await dashboardJson(Response, endpoint())
      items = response.data
      total = response.pagination.total
      selected = selected.filter((id) => response.data.some((item) => item.id === id))
    } catch {
      message = 'Could not load content.'
    } finally {
      pending = false
    }
  }

  const toggleSelected = (id: string) => {
    selected = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]
  }

  const editHref = (item: ItemValue) =>
    isAudio
      ? `/mix-upload?edit=${encodeURIComponent(item.slug)}`
      : `/new?mode=${contentType === 'post' ? 'editorial' : 'tweet'}&edit=${encodeURIComponent(item.slug)}`

  async function setDraft(slugs: ReadonlyArray<string>, draft: boolean) {
    if (slugs.length === 0) return
    pending = true
    message = ''

    try {
      await Promise.all(
        slugs.map((slug) =>
          dashboardCommand(`${actionBase}/${encodeURIComponent(slug)}`, jsonRequest('PATCH', { draft }))
        )
      )
      selected = []
      message = draft ? 'Moved to drafts.' : 'Published.'
      await load()
    } catch {
      message = 'Could not update every selected item.'
    } finally {
      pending = false
    }
  }

  onMount(load)
</script>

<Page {title} {description}>
  <div class="flex flex-wrap gap-3 rounded border p-4">
    {#if !isAudio}
      <form class="flex min-w-64 flex-1 gap-2" onsubmit={(event) => { event.preventDefault(); offset = 0; void load() }}>
        <input class="min-w-0 flex-1 rounded border bg-background px-3 py-2" type="search" placeholder="Search title or slug" bind:value={query} />
        <button class="rounded border px-4">Search</button>
      </form>
      <select class="rounded border bg-background px-3" value={status} onchange={(event) => { const decoded = Option.getOrNull(Schema.decodeUnknownOption(Status)(event.currentTarget.value)); if (decoded) { status = decoded; offset = 0; void load() } }}>
        <option value="all">All states</option><option value="draft">Drafts</option><option value="live">Published</option>
      </select>
    {/if}
    <a class="rounded bg-foreground px-4 py-2 text-background no-underline" href={isAudio ? '/mix-upload' : `/new?mode=${contentType === 'post' ? 'editorial' : 'tweet'}`}>Create new</a>
  </div>

  {#if selected.length > 0}
    <div class="flex items-center gap-3 rounded border-2 border-highlight bg-highlight/10 p-3"><strong>{selected.length} selected</strong><button class="underline" disabled={pending} onclick={() => void setDraft(items.filter((item) => selected.includes(item.id)).map((item) => item.slug), false)}>Publish</button><button class="underline" disabled={pending} onclick={() => void setDraft(items.filter((item) => selected.includes(item.id)).map((item) => item.slug), true)}>Move to drafts</button><button class="ml-auto underline" onclick={() => selected = []}>Clear</button></div>
  {/if}

  {#if pending && items.length === 0}<p>Loading…</p>{:else if items.length === 0}<p class="rounded border p-6 text-muted-foreground">No content matches these filters.</p>{:else}
    <div class="overflow-x-auto rounded border"><table class="w-full text-left text-sm"><thead class="bg-muted"><tr><th class="p-3"><span class="sr-only">Select</span></th><th>Title</th><th>Slug</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
      {#each items as item}<tr class="border-t"><td class="p-3"><input aria-label={`Select ${item.title ?? item.slug}`} type="checkbox" checked={selected.includes(item.id)} onchange={() => toggleSelected(item.id)} /></td><td class="max-w-80 truncate font-semibold">{item.title || 'Untitled'}</td><td class="font-mono text-xs">{item.slug}</td><td>{item.draft ? 'Draft' : 'Published'}</td><td>{new Date(item.updatedAt).toLocaleDateString()}</td><td class="whitespace-nowrap"><a class="mr-3 underline" href={editHref(item)}>Edit</a><button class="underline" disabled={pending} onclick={() => void setDraft([item.slug], !item.draft)}>{item.draft ? 'Publish' : 'Unpublish'}</button></td></tr>{/each}
    </tbody></table></div>
  {/if}
  <div class="flex justify-between"><button disabled={offset === 0 || pending} onclick={() => { offset = Math.max(0, offset - limit); void load() }}>Previous</button><span>{total === 0 ? 0 : offset + 1}–{Math.min(total, offset + items.length)} of {total}{scope === 'own' ? ' yours' : ''}</span><button disabled={offset + items.length >= total || pending} onclick={() => { offset += limit; void load() }}>Next</button></div>
  {#if message}<p aria-live="polite">{message}</p>{/if}
</Page>
