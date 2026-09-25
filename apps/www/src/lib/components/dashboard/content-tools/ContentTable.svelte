<script lang="ts">
  import { Schema } from 'effect'
  import { onMount } from 'svelte'
  import Page from '../Page.svelte'
  import { dashboardJson, jsonRequest } from '../api'

  const Creator = Schema.Struct({ id: Schema.String, name: Schema.String })

  const Item = Schema.Struct({
    id: Schema.String,
    title: Schema.NullOr(Schema.String),
    description: Schema.NullOr(Schema.String),
    thumbnailUrl: Schema.NullOr(Schema.String),
    slug: Schema.String,
    content: Schema.NullOr(Schema.String),
    draft: Schema.Boolean,
    createdAt: Schema.String,
    updatedAt: Schema.optional(Schema.String),
    tags: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
    creators: Schema.optional(Schema.Array(Creator)),
    url: Schema.optional(Schema.String),
    episodeNumber: Schema.optional(Schema.NullOr(Schema.Number)),
    playCount: Schema.optional(Schema.Number),
  })

  const Response = Schema.Struct({
    data: Schema.Array(Item),
    pagination: Schema.Struct({
      total: Schema.Number,
      limit: Schema.Number,
      offset: Schema.Number,
      hasMore: Schema.Boolean,
    }),
  })

  type ItemValue = typeof Item.Type

  let {
    title,
    description,
    kind,
    scope = 'own',
  }: {
    title: string
    description: string
    kind: 'mix' | 'post' | 'micro'
    scope?: 'own' | 'all'
  } = $props()

  let items = $state<ReadonlyArray<ItemValue>>([]),
    selected = $state<Array<string>>([]),
    offset = $state(0),
    total = $state(0),
    pending = $state(false),
    message = $state(''),
    editing = $state<ItemValue | null>(null)

  let form = $state({
    title: '',
    slug: '',
    description: '',
    content: '',
    thumbnailUrl: '',
    url: '',
    episodeNumber: '',
    tags: '',
    draft: false,
  })

  let sort = $state<'created' | 'plays'>('created'),
    order = $state<'asc' | 'desc'>('desc')

  const limit = 25,
    isMix = $derived(kind === 'mix'),
    base = $derived(isMix ? '/api/content/audio/mix' : '/api/content/posts')

  const endpoint = () =>
    `${base}/manage?${new URLSearchParams({ limit: String(limit), offset: String(offset), ...(isMix ? { sort, order } : { type: kind }) })}`

  async function load() {
    pending = true
    message = ''

    try {
      const result = await dashboardJson(Response, endpoint())
      items = result.data
      total = result.pagination.total
      selected = selected.filter((id) => items.some((item) => item.id === id))
    } catch {
      message = 'Could not load content.'
    } finally {
      pending = false
    }
  }

  function open(item: ItemValue) {
    editing = item
    form = {
      title: item.title ?? '',
      slug: item.slug,
      description: item.description ?? '',
      content: item.content ?? '',
      thumbnailUrl: item.thumbnailUrl ?? '',
      url: item.url ?? '',
      episodeNumber: item.episodeNumber ? String(item.episodeNumber) : '',
      tags: item.tags?.join(', ') ?? '',
      draft: item.draft,
    }
  }

  async function save() {
    if (!editing) return
    pending = true

    try {
      await dashboardJson(
        Item,
        `${base}/${encodeURIComponent(editing.slug)}`,
        jsonRequest('PATCH', {
          ...form,
          title: form.title || null,
          tags: form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          episodeNumber: form.episodeNumber ? Number(form.episodeNumber) : null,
        }),
      )
      editing = null
      message = 'Changes saved.'
      await load()
    } catch {
      message = 'Could not save changes.'
    } finally {
      pending = false
    }
  }

  async function setDraft(targets: ReadonlyArray<ItemValue>, draft: boolean) {
    pending = true

    try {
      await Promise.all(
        targets.map((item) =>
          dashboardJson(
            Item,
            `${base}/${encodeURIComponent(item.slug)}`,
            jsonRequest('PATCH', { draft }),
          ),
        ),
      )
      selected = []
      await load()
      message = draft ? 'Moved to draft.' : 'Published.'
    } catch {
      message = 'Some items could not be updated.'
    } finally {
      pending = false
    }
  }

  onMount(load)
</script>

<Page {title} {description}>
  <div class="flex justify-end">
    <a
      class="rounded bg-foreground px-4 py-2 text-background no-underline"
      href={isMix ? '/mix-upload' : `/new?mode=${kind === 'post' ? 'editorial' : 'tweet'}`}
      >Create new</a
    >
  </div>
  {#if selected.length}<div
      class="flex flex-wrap items-center gap-3 rounded border bg-muted/50 p-3"
    >
      <strong>{selected.length} selected</strong><button
        class="underline"
        onclick={() =>
          void setDraft(
            items.filter((item) => selected.includes(item.id)),
            false,
          )}>Publish</button
      ><button
        class="underline"
        onclick={() =>
          void setDraft(
            items.filter((item) => selected.includes(item.id)),
            true,
          )}>Move to draft</button
      ><button class="ml-auto underline" onclick={() => (selected = [])}>Clear</button>
    </div>{/if}
  <div class="overflow-x-auto rounded border">
    <table class="w-full text-left text-sm">
      <thead class="bg-muted"
        ><tr
          ><th class="p-3"
            ><input
              aria-label="Select all"
              type="checkbox"
              checked={items.length > 0 && items.every((item) => selected.includes(item.id))}
              onchange={() =>
                (selected = items.every((item) => selected.includes(item.id))
                  ? []
                  : items.map((item) => item.id))}
            /></th
          ><th>Title</th><th>Status</th><th>Media</th><th>Tags</th>{#if isMix}<th
              ><button
                onclick={() => {
                  sort = 'plays'
                  order = order === 'desc' ? 'asc' : 'desc'
                  offset = 0
                  void load()
                }}>Plays {sort === 'plays' ? (order === 'desc' ? '↓' : '↑') : ''}</button
              ></th
            >{/if}{#if scope === 'all'}<th>Created by</th>{/if}<th>Created</th><th>Actions</th></tr
        ></thead
      ><tbody>
        {#each items as item}<tr class="border-t hover:bg-muted/40"
            ><td class="p-3"
              ><input
                aria-label={`Select ${item.title ?? item.slug}`}
                type="checkbox"
                checked={selected.includes(item.id)}
                onchange={() =>
                  (selected = selected.includes(item.id)
                    ? selected.filter((id) => id !== item.id)
                    : [...selected, item.id])}
              /></td
            ><td class="max-w-72 p-3"
              ><strong>{item.title || 'Untitled'}</strong><span
                class="block truncate font-mono text-xs text-muted-foreground">{item.slug}</span
              ></td
            ><td
              ><button
                class="rounded bg-muted px-2 py-1"
                onclick={() => void setDraft([item], !item.draft)}
                >{item.draft ? 'Draft' : 'Live'}</button
              ></td
            ><td
              ><span class="rounded border px-1">Art {item.thumbnailUrl ? '✓' : '–'}</span>
              <span class="rounded border px-1">MDX {item.content?.trim() ? '✓' : '–'}</span></td
            ><td class="max-w-40 truncate">{item.tags?.join(', ') || '—'}</td>{#if isMix}<td
                >{item.playCount?.toLocaleString() ?? 0}</td
              >{/if}{#if scope === 'all'}<td
                >{item.creators?.map((creator) => creator.name).join(', ') || '—'}</td
              >{/if}<td>{new Date(item.createdAt).toLocaleDateString()}</td><td
              class="whitespace-nowrap"
              ><a
                class="mr-3 underline"
                href={isMix
                  ? `/mix-upload?edit=${encodeURIComponent(item.slug)}`
                  : `/new?edit=${encodeURIComponent(item.slug)}`}>Edit</a
              ><button class="mr-3 underline" onclick={() => open(item)}>Quick edit</button><a
                class="underline"
                href={isMix
                  ? `/mixes/${item.slug}`
                  : kind === 'post'
                    ? `/editorial/${item.slug}`
                    : `/tweet/${item.slug}`}>View</a
              ></td
            ></tr
          >{/each}
        {#if !pending && items.length === 0}<tr
            ><td class="p-8 text-center text-muted-foreground" colspan="9">No content found.</td
            ></tr
          >{/if}
      </tbody>
    </table>
  </div>
  <div class="flex justify-between text-sm">
    <button
      disabled={offset === 0 || pending}
      onclick={() => {
        offset = Math.max(0, offset - limit)
        void load()
      }}>Previous</button
    ><span>{total ? offset + 1 : 0}–{Math.min(total, offset + items.length)} of {total}</span
    ><button
      disabled={offset + items.length >= total || pending}
      onclick={() => {
        offset += limit
        void load()
      }}>Next</button
    >
  </div>
  {#if editing}<div
      class="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="presentation"
      onclick={(event) => {
        if (event.target === event.currentTarget) editing = null
      }}
    >
      <form
        class="h-full w-full max-w-2xl space-y-4 overflow-y-auto bg-background p-6 shadow-xl"
        onsubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div class="flex justify-between">
          <div>
            <h2 class="text-xl font-bold">Edit {editing.title || 'content'}</h2>
            <p class="text-sm text-muted-foreground">Metadata, publishing state, media and MDX.</p>
          </div>
          <button type="button" onclick={() => (editing = null)}>✕</button>
        </div>
        <label class="flex gap-2"><input type="checkbox" bind:checked={form.draft} /> Draft</label>
        <div class="grid gap-4 sm:grid-cols-2">
          <label
            >Title<input class="block w-full rounded border p-2" bind:value={form.title} /></label
          ><label
            >Slug<input class="block w-full rounded border p-2" bind:value={form.slug} /></label
          >
        </div>
        <label
          >Description<textarea
            class="block w-full rounded border p-2"
            bind:value={form.description}></textarea></label
        >{#if isMix}<div class="grid gap-4 sm:grid-cols-2">
            <label
              >Audio URL<input
                class="block w-full rounded border p-2"
                bind:value={form.url}
              /></label
            ><label
              >Episode number<input
                type="number"
                class="block w-full rounded border p-2"
                bind:value={form.episodeNumber}
              /></label
            >
          </div>{/if}<label
          >Thumbnail URL<input
            class="block w-full rounded border p-2"
            bind:value={form.thumbnailUrl}
          /></label
        ><label>Tags<input class="block w-full rounded border p-2" bind:value={form.tags} /></label
        ><label
          >Content (MDX)<textarea
            class="block min-h-64 w-full rounded border p-2 font-mono"
            bind:value={form.content}></textarea></label
        >
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded border px-4 py-2" onclick={() => (editing = null)}
            >Cancel</button
          ><button class="rounded bg-foreground px-4 py-2 text-background" disabled={pending}
            >{pending ? 'Saving…' : 'Save changes'}</button
          >
        </div>
      </form>
    </div>{/if}
  {#if message}<p aria-live="polite">{message}</p>{/if}
</Page>
