<script lang="ts">
  import { Schema } from 'effect'
  import { onMount } from 'svelte'
  import { dashboardJson, jsonRequest } from '@/lib/components/dashboard/api'

  const Preferences = Schema.Struct({ id: Schema.String, userId: Schema.String, mixReleaseEnabled: Schema.Boolean, promotionalEnabled: Schema.Boolean, systemEnabled: Schema.Boolean, globalUnsubscribe: Schema.Boolean, unsubscribeToken: Schema.NullOr(Schema.String), createdAt: Schema.String, updatedAt: Schema.String })
  type Values = Pick<typeof Preferences.Type, 'mixReleaseEnabled' | 'promotionalEnabled' | 'systemEnabled' | 'globalUnsubscribe'>
  let values = $state<Values>({ mixReleaseEnabled: true, promotionalEnabled: true, systemEnabled: true, globalUnsubscribe: false })
  let loading = $state(true)
  let error = $state('')

  onMount(async () => {
    try {
      const response = await dashboardJson(Preferences, '/api/user/email-preferences')
      values = { mixReleaseEnabled: response.mixReleaseEnabled, promotionalEnabled: response.promotionalEnabled, systemEnabled: response.systemEnabled, globalUnsubscribe: response.globalUnsubscribe }
    } catch { error = 'Could not load email preferences.' }
    finally { loading = false }
  })

  async function update(key: keyof Values, value: boolean) {
    const previous = values
    values = { ...values, [key]: value }
    error = ''
    try { await dashboardJson(Preferences, '/api/user/email-preferences', jsonRequest('PATCH', values)) }
    catch { values = previous; error = 'Failed to update email preferences. Please try again later.' }
  }

  const rows: ReadonlyArray<{ key: Exclude<keyof Values, 'globalUnsubscribe'>; title: string; description: string }> = [
    { key: 'mixReleaseEnabled', title: 'New Mix & Show Updates', description: 'The newsletter: get notified when a new mix or show drops' },
    { key: 'promotionalEnabled', title: 'Promotional Emails', description: 'Receive updates about new features and promotions' },
    { key: 'systemEnabled', title: 'System Notifications', description: 'Important updates about your account and system changes' }
  ]
</script>

<section class="max-w-2xl border border-border">
  <header class="border-b border-border p-6"><h2 class="text-xl font-bold">Email Preferences</h2></header>
  <div class="space-y-5 p-6">
    {#if loading}<p class="text-muted-foreground">Loading email preferences…</p>{/if}
    {#each rows as row}
      <label class="flex items-center justify-between gap-6" class:opacity-50={values.globalUnsubscribe}>
        <span class="flex-1"><strong class="text-base font-medium">{row.title}</strong><span class="block text-base text-muted-foreground">{row.description}</span></span>
        <input type="checkbox" checked={values[row.key]} disabled={loading || values.globalUnsubscribe} onchange={(event) => void update(row.key, event.currentTarget.checked)} class="h-4 w-4 accent-primary" />
      </label>
    {/each}
    <div class="border-t border-border pt-4">
      <label class="flex items-center justify-between gap-6"><span class="flex-1"><strong class="text-base font-medium text-destructive">Unsubscribe from All</strong><span class="block text-base text-muted-foreground">Opt out of the newsletter and all non-essential emails</span></span><input type="checkbox" checked={values.globalUnsubscribe} disabled={loading} onchange={(event) => void update('globalUnsubscribe', event.currentTarget.checked)} class="h-4 w-4 accent-destructive" /></label>
    </div>
    {#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
  </div>
</section>
