<script lang="ts">
  import { AdminTelemetryResponse } from '@gbfm/api/admin'

  import { dashboardJson } from '../api'
  import { telemetryDashboardState, telemetryP75 } from './telemetry-dashboard'

  type Scenario = { label: string; description: string; value: string; report: boolean }

  const scenarios: Array<Scenario> = [
    {
      label: '200 OK',
      description: 'Confirms the helper endpoint is reachable.',
      value: 'ok',
      report: false,
    },
    {
      label: '400 Bad Request',
      description: 'Expected client error; remains quiet.',
      value: 'bad-request',
      report: false,
    },
    {
      label: '404 Not Found',
      description: 'Expected missing resource; remains quiet.',
      value: 'not-found',
      report: false,
    },
    {
      label: '429 Rate Limit',
      description: 'Expected throttling; remains quiet.',
      value: 'rate-limit',
      report: false,
    },
    {
      label: '500 Server Error',
      description: 'Cloudflare telemetry records a server failure.',
      value: 'error',
      report: true,
    },
    {
      label: '503 Unavailable',
      description: 'Mirrors a backend incident and is reported.',
      value: 'unavailable',
      report: true,
    },
  ]

  let pending = $state(''),
    result = $state<{ label: string; ok: boolean; message: string }>()

  let telemetry = $state<AdminTelemetryResponse>()

  let telemetryFailed = $state(false)

  $effect(() => {
    dashboardJson(AdminTelemetryResponse, '/api/admin/telemetry').then(
      (value) => (telemetry = value),
      () => (telemetryFailed = true),
    )
  })

  const dashboard = $derived(telemetryDashboardState(telemetry, telemetryFailed))

  async function run(scenario: Scenario) {
    pending = scenario.value
    result = undefined

    try {
      const response = await fetch(`/api/admin/frontend-errors/${scenario.value}`)

      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      result = { label: scenario.label, ok: true, message: 'Request completed successfully.' }
    } catch (cause) {
      result = {
        label: scenario.label,
        ok: false,
        message: cause instanceof Error ? cause.message : String(cause),
      }
    } finally {
      pending = ''
    }
  }

  async function network() {
    pending = 'network'
    result = undefined

    try {
      await fetch('https://127.0.0.1:1/gbfm-frontend-error-demo')
      result = {
        label: 'Network failure',
        ok: true,
        message: 'Unexpectedly completed successfully.',
      }
    } catch (cause) {
      result = {
        label: 'Network failure',
        ok: false,
        message: cause instanceof Error ? cause.message : String(cause),
      }
    } finally {
      pending = ''
    }
  }
</script>

<div class="space-y-6">
  <section class="rounded border p-5" aria-live="polite">
    <h2 class="text-xl font-bold">Browser and player health</h2>
    {#if dashboard.status === 'loading'}
      <p class="mt-3 text-sm text-muted-foreground">Loading telemetry…</p>
    {:else if dashboard.status === 'error'}
      <p class="mt-3 text-sm text-destructive">{dashboard.message} Try refreshing this page.</p>
    {:else if dashboard.status === 'empty'}
      <p class="mt-3 text-sm text-muted-foreground">
        No sampled browser telemetry was recorded in the last {dashboard.data.windowHours} hours.
      </p>
    {:else}
      {#if dashboard.status === 'partial'}
        <p class="mt-3 rounded border border-amber-500/50 p-3 text-sm">
          Some telemetry queries are unavailable. Available sections remain current.
        </p>
      {/if}
      <div class="mt-4 grid gap-4 xl:grid-cols-2">
        {#each Object.entries(dashboard.data.sections) as [key, section]}
          <article class="min-w-0 rounded border p-4">
            <h3 class="font-semibold capitalize">{key.replace('webVitals', 'Web vitals')}</h3>
            {#if !section.available}
              <p class="mt-2 text-sm text-muted-foreground">Unavailable</p>
            {:else if section.rows.length === 0}
              <p class="mt-2 text-sm text-muted-foreground">No events in this window.</p>
            {:else}
              <div class="mt-3 space-y-3 md:hidden">
                {#each section.rows as row}
                  <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded border p-3 text-xs">
                    <dt class="text-muted-foreground">Event</dt>
                    <dd class="min-w-0 break-words uppercase">{row.name}</dd>
                    <dt class="text-muted-foreground">Route</dt>
                    <dd class="min-w-0 break-words">{row.route}</dd>
                    <dt class="text-muted-foreground">Release</dt>
                    <dd class="min-w-0 break-words">{row.release} / {row.browser}</dd>
                    <dt class="text-muted-foreground">Samples</dt>
                    <dd>{row.samples.toLocaleString()}</dd>
                    <dt class="text-muted-foreground">p75</dt>
                    <dd>{telemetryP75(key, row.name, row.p75)}</dd>
                  </dl>
                {/each}
              </div>
              <div class="mt-3 hidden overflow-x-auto md:block">
                <table class="w-full text-left text-xs">
                  <thead
                    ><tr
                      ><th>Event</th><th>Route</th><th>Release / browser</th><th>Samples</th><th
                        >p75</th
                      ></tr
                    ></thead
                  >
                  <tbody>
                    {#each section.rows as row}
                      <tr class="border-t"
                        ><td class="uppercase">{row.name}</td><td>{row.route}</td><td
                          >{row.release} / {row.browser}</td
                        ><td>{row.samples.toLocaleString()}</td><td
                          >{telemetryP75(key, row.name, row.p75)}</td
                        ></tr
                      >
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </article>
        {/each}
      </div>
      <p class="mt-4 text-xs text-muted-foreground">{dashboard.data.retentionNotice}</p>
    {/if}
  </section>
  <section class="rounded border p-5">
    <h2 class="text-xl font-bold">API response scenarios</h2>
    <p class="mt-2 text-sm text-muted-foreground">
      Exercise Cloudflare-native browser telemetry and the frontend API failure path.
    </p>
    <div class="mt-4 grid gap-3 md:grid-cols-2">
      {#each scenarios as scenario}<article class="flex flex-col gap-3 rounded border p-4">
          <div class="flex justify-between gap-3">
            <div>
              <h3 class="font-semibold">{scenario.label}</h3>
              <p class="mt-1 text-sm text-muted-foreground">{scenario.description}</p>
            </div>
            <span class="h-fit rounded-full border px-2 py-1 text-xs"
              >{scenario.report ? 'Telemetry' : 'Quiet'}</span
            >
          </div>
          <button
            class={`rounded px-4 py-2 ${scenario.report ? 'bg-destructive text-destructive-foreground' : 'border'}`}
            disabled={pending !== ''}
            onclick={() => void run(scenario)}
            >{pending === scenario.value ? 'Running…' : 'Run scenario'}</button
          >
        </article>{/each}
    </div>
  </section>
  <section
    class="flex flex-col justify-between gap-4 rounded border p-5 sm:flex-row sm:items-center"
  >
    <div>
      <h2 class="font-bold">Network failure</h2>
      <p class="text-sm text-muted-foreground">
        Calls an unreachable loopback endpoint to exercise failed-fetch telemetry.
      </p>
    </div>
    <button
      class="rounded bg-destructive px-4 py-2 text-destructive-foreground"
      disabled={pending !== ''}
      onclick={() => void network()}
      >{pending === 'network' ? 'Running…' : 'Run network failure'}</button
    >
  </section>
  {#if result}<output class={`block rounded border p-5 ${result.ok ? '' : 'border-destructive/50'}`}
      ><strong>{result.label}</strong>
      <p class="mt-1 text-sm text-muted-foreground">{result.message}</p></output
    >{/if}
</div>
