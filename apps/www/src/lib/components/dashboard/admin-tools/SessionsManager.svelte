<script lang="ts">
  import { Schema } from 'effect'
  import { dashboardJson, jsonRequest } from '../api'

  const User = Schema.Struct({ id: Schema.String, name: Schema.String, email: Schema.String })

  const Users = Schema.Struct({
    users: Schema.Array(User),
    total: Schema.Number,
    limit: Schema.Number,
    offset: Schema.optional(Schema.Number),
  })

  const Session = Schema.Struct({
    id: Schema.String,
    token: Schema.String,
    userId: Schema.String,
    createdAt: Schema.Union([Schema.String, Schema.Date]),
    expiresAt: Schema.Union([Schema.String, Schema.Date]),
    userAgent: Schema.optional(Schema.NullOr(Schema.String)),
    ipAddress: Schema.optional(Schema.NullOr(Schema.String)),
  })

  const Sessions = Schema.Struct({ sessions: Schema.Array(Session) })

  type UserValue = typeof User.Type

  let query = $state(''),
    results = $state<ReadonlyArray<UserValue>>([]),
    selected = $state<UserValue | null>(null),
    sessions = $state<ReadonlyArray<typeof Session.Type>>([]),
    message = $state(''),
    loading = $state(false),
    pending = $state(false)

  async function search() {
    if (query.length < 3) return
    loading = true
    message = ''

    try {
      const q = new URLSearchParams({ limit: '5', searchValue: query, searchField: 'email' })
      results = (await dashboardJson(Users, `/auth/admin/list-users?${q}`)).users
    } catch {
      message = 'Search failed.'
    } finally {
      loading = false
    }
  }

  async function choose(user: UserValue) {
    selected = user
    results = []
    loading = true

    try {
      sessions = (
        await dashboardJson(
          Sessions,
          '/auth/admin/list-user-sessions',
          jsonRequest('POST', { userId: user.id }),
        )
      ).sessions
    } catch {
      message = 'Could not load sessions.'
    } finally {
      loading = false
    }
  }

  async function revoke(path: string, body: Schema.Json) {
    if (!selected) return
    pending = true

    try {
      await dashboardJson(Schema.Unknown, `/auth/admin/${path}`, jsonRequest('POST', body))
      message = 'Session access revoked.'
      await choose(selected)
    } catch {
      message = 'Could not revoke session.'
    } finally {
      pending = false
    }
  }
</script>

<div class="space-y-6">
  <form
    class="space-y-2"
    onsubmit={(e) => {
      e.preventDefault()
      void search()
    }}
  >
    <label class="block font-medium" for="session-user-search">Search user by email</label>
    <div class="flex gap-2">
      <input
        id="session-user-search"
        class="w-full max-w-sm rounded border bg-background p-2"
        type="email"
        placeholder="Enter user email…"
        bind:value={query}
        oninput={() => {
          selected = null
          if (query.length > 2) void search()
        }}
      /><button class="rounded border px-4" disabled={query.length < 3}>Search</button>
    </div>
    {#if loading}<p class="text-sm text-muted-foreground">
        Loading…
      </p>{/if}{#if results.length && !selected}<div class="max-w-sm rounded border p-2">
        {#each results as user}<button
            type="button"
            class="block w-full rounded p-2 text-left hover:bg-muted"
            onclick={() => void choose(user)}
            ><strong>{user.name}</strong><span class="ml-2 text-sm text-muted-foreground"
              >{user.email}</span
            ></button
          >{/each}
      </div>{/if}
  </form>
  {#if selected}<section class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-bold">Sessions for {selected.name}</h2>
          <p class="text-sm text-muted-foreground">{selected.email}</p>
        </div>
        <div class="space-x-2">
          <button class="rounded border px-3 py-2" onclick={() => (selected = null)}>Clear</button
          >{#if sessions.length}<button
              class="rounded bg-destructive px-3 py-2 text-destructive-foreground"
              disabled={pending}
              onclick={() => {
                if (confirm(`Revoke all sessions for ${selected?.name}?`))
                  void revoke('revoke-user-sessions', { userId: selected?.id ?? '' })
              }}>Revoke all</button
            >{/if}
        </div>
      </div>
      {#if !loading && sessions.length === 0}<p
          class="rounded border p-8 text-center text-muted-foreground"
        >
          No active sessions found.
        </p>{:else}<div class="overflow-x-auto rounded border">
          <table class="w-full text-left text-sm">
            <thead class="bg-muted/50"
              ><tr
                ><th class="p-3">Session ID</th><th class="p-3">Created</th><th class="p-3"
                  >Expires</th
                ><th class="p-3">User agent</th><th class="p-3">IP</th><th class="p-3">Actions</th
                ></tr
              ></thead
            ><tbody
              >{#each sessions as session}<tr class="border-t"
                  ><td class="p-3 font-mono text-xs">{session.id.slice(0, 8)}…</td><td class="p-3"
                    >{new Date(session.createdAt).toLocaleString()}</td
                  ><td class="p-3">{new Date(session.expiresAt).toLocaleString()}</td><td
                    class="max-w-xs truncate p-3"
                    title={session.userAgent ?? undefined}>{session.userAgent ?? 'Unknown'}</td
                  ><td class="p-3">{session.ipAddress ?? '—'}</td><td class="p-3"
                    ><button
                      class="text-destructive underline"
                      disabled={pending}
                      onclick={() =>
                        void revoke('revoke-user-session', { sessionToken: session.token })}
                      >Revoke</button
                    ></td
                  ></tr
                >{/each}</tbody
            >
          </table>
        </div>{/if}
    </section>{/if}{#if !selected && !query}<p
      class="rounded border p-8 text-center text-muted-foreground"
    >
      Search for a user to inspect active sessions.
    </p>{/if}{#if message}<p class="rounded border p-3" aria-live="polite">{message}</p>{/if}
</div>
