<script lang="ts">
  import { Option, Schema } from 'effect'
  import { onMount } from 'svelte'

  const Cell = Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null])

  const Row = Schema.Record(Schema.String, Cell)

  const Rows = Schema.Array(Row)

  const Pagination = Schema.Struct({ total: Schema.Number })

  const RowEnvelope = Schema.Struct({
    items: Schema.optional(Rows),
    data: Schema.optional(Rows),
    users: Schema.optional(Rows),
    sessions: Schema.optional(Rows),
    shows: Schema.optional(Rows),
    subscribers: Schema.optional(Rows),
    playlists: Schema.optional(Rows),
    pagination: Schema.optional(Pagination),
  })

  let {
    endpoint,
    empty = 'Nothing to show.',
    refresh = 0,
    actionBase,
    idKey = 'slug',
  }: {
    endpoint: string
    empty?: string
    refresh?: number
    actionBase?: string
    idKey?: string
  } = $props()

  type CellValue = typeof Cell.Type

  type RowValue = typeof Row.Type

  let rows = $state<ReadonlyArray<RowValue>>([]),
    loading = $state(true),
    message = $state('')

  let offset = $state(0),
    total = $state(0),
    pendingId = $state('')

  const pageSize = 50

  const columns = $derived(rows[0] ? Object.keys(rows[0]).slice(0, 6) : [])

  const display = (value: CellValue | undefined) => (value == null ? '—' : String(value))

  const requestUrl = () => {
    const url = new URL(endpoint, location.origin)
    url.searchParams.set('offset', String(offset))

    return url.pathname + url.search
  }

  function parseResponse(input: Schema.Json) {
    const direct = Option.getOrNull(Schema.decodeUnknownOption(Rows)(input))

    if (direct) return { rows: direct, total: undefined }
    const envelope = Option.getOrNull(Schema.decodeUnknownOption(RowEnvelope)(input))

    if (!envelope) return { rows: [], total: undefined }

    return {
      rows:
        envelope.items ??
        envelope.data ??
        envelope.users ??
        envelope.sessions ??
        envelope.shows ??
        envelope.subscribers ??
        envelope.playlists ??
        [],
      total: envelope.pagination?.total,
    }
  }

  async function load() {
    loading = true
    message = ''

    try {
      const response = await fetch(requestUrl())

      if (!response.ok) throw new Error(`Request failed (${response.status})`)
      const body: Schema.Json = await response.json()
      const parsed = parseResponse(body)
      rows = parsed.rows
      total =
        parsed.total ?? (rows.length < pageSize ? offset + rows.length : offset + pageSize + 1)
    } catch (cause) {
      message = cause instanceof Error ? cause.message : 'Request failed'
    } finally {
      loading = false
    }
  }

  async function act(
    row: RowValue,
    method: 'PATCH' | 'DELETE',
    body?: { readonly draft: boolean },
  ) {
    if (!actionBase) return
    const id = row[idKey]

    if (!Schema.is(Schema.String)(id)) return

    if (method === 'DELETE' && !confirm(`Delete ${display(row.title ?? row.name ?? id)}?`)) return
    pendingId = id
    message = ''

    const init: RequestInit = body
      ? { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      : { method }

    const response = await fetch(`${actionBase}/${encodeURIComponent(id)}`, init)
    pendingId = ''

    if (!response.ok) {
      message = `Action failed (${response.status}).`

      return
    }

    await load()
  }

  onMount(load)

  $effect(() => {
    if (refresh > 0) void load()
  })
</script>

{#if loading}<p aria-live="polite">Loading…</p>
{:else if message}<p class="rounded border border-destructive p-4 text-destructive">{message}</p>
{:else if rows.length === 0}<p class="rounded border p-6 text-muted-foreground">{empty}</p>
{:else}
  <div class="overflow-x-auto rounded border">
    <table class="w-full text-left text-sm">
      <thead class="bg-muted"
        ><tr
          >{#each columns as key}<th class="p-3">{key}</th>{/each}{#if actionBase}<th class="p-3"
              >Actions</th
            >{/if}</tr
        ></thead
      ><tbody
        >{#each rows as row}<tr class="border-t"
            >{#each columns as key}<td class="max-w-64 truncate p-3">{display(row[key])}</td
              >{/each}{#if actionBase}<td class="whitespace-nowrap p-3"
                ><button
                  class="mr-3 underline"
                  disabled={pendingId === row[idKey]}
                  onclick={() => void act(row, 'PATCH', { draft: !row.draft })}
                  >{row.draft === true ? 'Publish' : 'Draft'}</button
                ><button
                  class="text-destructive underline"
                  disabled={pendingId === row[idKey]}
                  onclick={() => void act(row, 'DELETE')}>Delete</button
                ></td
              >{/if}</tr
          >{/each}</tbody
      >
    </table>
  </div>
  <div class="mt-4 flex items-center justify-between">
    <button
      class="rounded border px-3 py-2 disabled:opacity-40"
      disabled={offset === 0}
      onclick={() => {
        offset = Math.max(0, offset - pageSize)
        void load()
      }}>Previous</button
    ><span class="text-sm text-muted-foreground"
      >{offset + 1}–{offset + rows.length}{total ? ` of ${total}` : ''}</span
    ><button
      class="rounded border px-3 py-2 disabled:opacity-40"
      disabled={offset + rows.length >= total}
      onclick={() => {
        offset += pageSize
        void load()
      }}>Next</button
    >
  </div>
{/if}
