<script lang="ts">
  import type { EmailPreferenceValues } from '@/lib/account/email-preferences'
  import { EmailPreferences } from '@/lib/account/email-preferences'
  import { dashboardJson, jsonRequest } from '@/lib/components/dashboard/api'

  type Preferences = typeof EmailPreferences.Type
  let { initialPreferences, initialError = null }: { initialPreferences: Preferences | null; initialError?: string | null } = $props()
  let values = $derived<EmailPreferenceValues>(initialPreferences ? { mixReleaseEnabled: initialPreferences.mixReleaseEnabled, promotionalEnabled: initialPreferences.promotionalEnabled, systemEnabled: initialPreferences.systemEnabled, globalUnsubscribe: initialPreferences.globalUnsubscribe } : { mixReleaseEnabled: true, promotionalEnabled: true, systemEnabled: true, globalUnsubscribe: false })
  let error = $derived(initialError ?? '')

  async function update(key: keyof EmailPreferenceValues, value: boolean) {
    const previous = values
    values = { ...values, [key]: value }
    error = ''
    try { await dashboardJson(EmailPreferences, '/api/user/email-preferences', jsonRequest('PATCH', values)) }
    catch { values = previous; error = 'Failed to update email preferences. Please try again later.' }
  }

  const rows: ReadonlyArray<{ key: Exclude<keyof EmailPreferenceValues, 'globalUnsubscribe'>; title: string; description: string }> = [
    { key: 'mixReleaseEnabled', title: 'New Mix & Show Updates', description: 'The newsletter: get notified when a new mix or show drops' },
    { key: 'promotionalEnabled', title: 'Promotional Emails', description: 'Receive updates about new features and promotions' },
    { key: 'systemEnabled', title: 'System Notifications', description: 'Important updates about your account and system changes' }
  ]
</script>

<section class="max-w-2xl border border-border">
  <header class="border-b border-border p-6"><h2 class="text-xl font-bold">Email Preferences</h2></header>
  <div class="space-y-5 p-6">
    {#each rows as row}
      <label class="flex items-center justify-between gap-6" class:opacity-50={values.globalUnsubscribe}>
        <span class="flex-1"><strong class="text-base font-medium">{row.title}</strong><span class="block text-base text-muted-foreground">{row.description}</span></span>
        <input type="checkbox" checked={values[row.key]} disabled={!initialPreferences || values.globalUnsubscribe} onchange={(event) => void update(row.key, event.currentTarget.checked)} class="h-4 w-4 accent-primary" />
      </label>
    {/each}
    <div class="border-t border-border pt-4">
      <label class="flex items-center justify-between gap-6"><span class="flex-1"><strong class="text-base font-medium text-destructive">Unsubscribe from All</strong><span class="block text-base text-muted-foreground">Opt out of the newsletter and all non-essential emails</span></span><input type="checkbox" checked={values.globalUnsubscribe} disabled={!initialPreferences} onchange={(event) => void update('globalUnsubscribe', event.currentTarget.checked)} class="h-4 w-4 accent-destructive" /></label>
    </div>
    {#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
  </div>
</section>
