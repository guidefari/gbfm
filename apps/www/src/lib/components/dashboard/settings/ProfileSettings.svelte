<script lang="ts">
  import { SocialLinksResponse, UserProfileResponse } from '@gbfm/api/user'
  import { dashboardCommand, dashboardJson, jsonRequest } from '@/lib/components/dashboard/api'

  type Profile = typeof UserProfileResponse.Type

  type Link = Profile['socialLinks'][number]

  type PlatformValue = Link['platform']

  const platforms: ReadonlyArray<PlatformValue> = [
    'bandcamp',
    'substack',
    'soundcloud',
    'instagram',
    'twitter',
    'tiktok',
  ]

  let {
    initialProfile,
    initialError = null,
  }: { initialProfile: Profile | null; initialError?: string | null } = $props()

  let username = $derived(initialProfile?.username ?? '')

  let email = $derived(initialProfile?.email ?? '')

  let image = $derived(initialProfile?.image ?? initialProfile?.avatarUrl ?? '')

  let imagePreview = $state('')

  let avatar: File | undefined = $state()

  let links = $derived<ReadonlyArray<Link>>(initialProfile?.socialLinks ?? [])

  let profilePending = $state(false)

  let linksPending = $state(false)

  let resetPending = $state(false)

  let message = $derived(initialError ?? '')

  let failed = $derived(Boolean(initialError))

  function notify(text: string, isError = false) {
    message = text
    failed = isError
  }

  function selectAvatar(file: File | undefined) {
    if (!file) return
    avatar = file
    imagePreview = URL.createObjectURL(file)
  }

  async function saveProfile() {
    profilePending = true
    const body = new FormData()
    body.set('username', username)
    body.set('email', email)

    if (avatar) body.set('avatar', avatar)

    try {
      const profile = await dashboardJson(UserProfileResponse, '/api/user/profile', {
        method: 'PATCH',
        body,
      })

      image = profile.image ?? profile.avatarUrl ?? image
      imagePreview = ''
      avatar = undefined
      notify('Profile updated')
    } catch {
      notify('Failed to update profile. Please try again later.', true)
    } finally {
      profilePending = false
    }
  }

  async function saveLinks() {
    linksPending = true

    const cleaned = links
      .filter((link) => link.url.trim())
      .map((link, position) => ({ ...link, position }))

    try {
      links = await dashboardJson(
        SocialLinksResponse,
        '/api/user/profile/social-links',
        jsonRequest('PUT', cleaned),
      )
      notify('Social links updated')
    } catch {
      notify('Failed to update social links.', true)
    } finally {
      linksPending = false
    }
  }

  async function resetPassword() {
    resetPending = true

    try {
      await dashboardCommand(
        '/auth/forget-password',
        jsonRequest('POST', { email, redirectTo: `${location.origin}/auth/reset-password` }),
      )
      notify('Reset link sent. Check your inbox.')
    } catch {
      notify('Failed to send reset link. Please try again later.', true)
    } finally {
      resetPending = false
    }
  }

  function moveLink(index: number, offset: -1 | 1) {
    const target = index + offset
    const currentLink = links[index]
    const targetLink = links[target]

    if (!currentLink || !targetLink) return
    const next = [...links]
    next[index] = targetLink
    next[target] = currentLink
    links = next
  }
</script>

<div class="max-w-2xl space-y-6">
  <section class="border border-border">
    <header class="border-b border-border p-6"><h2 class="text-xl font-bold">Profile</h2></header>
    <form
      class="space-y-6 p-6"
      onsubmit={(event) => {
        event.preventDefault()
        void saveProfile()
      }}
    >
      <div class="flex justify-center">
        <label
          class="group relative h-20 w-20 cursor-pointer overflow-hidden rounded-sm"
          aria-label="Change avatar"
        >
          {#if imagePreview || image}<img
              src={imagePreview || image}
              alt="User Avatar"
              class="h-20 w-20 object-cover"
            />{:else}<span
              class="flex h-20 w-20 items-center justify-center bg-muted text-2xl text-muted-foreground"
              >{(username || email || '?').charAt(0).toUpperCase()}</span
            >{/if}
          <span
            class="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
            >Change</span
          >
          <input
            class="sr-only"
            type="file"
            accept="image/*"
            onchange={(event) => selectAvatar(event.currentTarget.files?.[0])}
          />
        </label>
      </div>
      <label class="grid gap-1.5 font-medium"
        >Username<input
          class="border border-border bg-background px-3 py-2"
          name="username"
          placeholder="Choose a username"
          bind:value={username}
        /></label
      >
      <label class="grid gap-1.5 font-medium"
        >Email<input
          class="border border-border bg-background px-3 py-2"
          name="email"
          type="email"
          bind:value={email}
        /></label
      >
      <button
        class="w-full bg-foreground px-4 py-2 font-bold text-background disabled:opacity-50"
        type="submit"
        disabled={!initialProfile || profilePending}
        >{profilePending ? 'Saving...' : 'Save Profile'}</button
      >
    </form>
  </section>

  <section class="border border-border">
    <header class="flex items-center justify-between border-b border-border p-6">
      <h2 class="text-xl font-bold">Social Links</h2>
      <button
        type="button"
        class="border border-border px-3 py-1.5 text-sm font-bold"
        onclick={() =>
          (links = [...links, { platform: 'bandcamp', url: '', position: links.length }])}
        >+ Add Link</button
      >
    </header>
    <div class="space-y-4 p-6">
      <p class="text-xs text-muted-foreground">
        Use the arrows to reorder. Empty URLs are ignored on save.
      </p>
      {#if links.length === 0}<div
          class="border border-dashed border-border p-4 text-muted-foreground"
        >
          No social links yet.
        </div>{/if}
      {#each links as link, index}
        <div class="grid gap-2 sm:grid-cols-[9rem_1fr_auto]">
          <select
            class="border border-border bg-background p-2"
            value={link.platform}
            onchange={(event) => {
              const platform = event.currentTarget.value as PlatformValue
              links = links.map((item, itemIndex) =>
                itemIndex === index ? { ...item, platform } : item,
              )
            }}
            >{#each platforms as platform}<option value={platform}>{platform}</option
              >{/each}</select
          >
          <input
            class="min-w-0 border border-border bg-background p-2"
            type="url"
            placeholder="https://…"
            value={link.url}
            oninput={(event) =>
              (links = links.map((item, itemIndex) =>
                itemIndex === index ? { ...item, url: event.currentTarget.value } : item,
              ))}
          />
          <div class="flex gap-1">
            <button
              type="button"
              aria-label="Move link up"
              disabled={index === 0}
              onclick={() => moveLink(index, -1)}>↑</button
            ><button
              type="button"
              aria-label="Move link down"
              disabled={index === links.length - 1}
              onclick={() => moveLink(index, 1)}>↓</button
            ><button
              type="button"
              class="ml-2 text-destructive"
              onclick={() => (links = links.filter((_, itemIndex) => itemIndex !== index))}
              >Remove</button
            >
          </div>
        </div>
      {/each}
      <button
        class="w-full bg-foreground px-4 py-2 font-bold text-background disabled:opacity-50"
        type="button"
        disabled={!initialProfile || linksPending}
        onclick={() => void saveLinks()}>{linksPending ? 'Saving...' : 'Save Social Links'}</button
      >
    </div>
  </section>

  <section class="border border-border">
    <header class="border-b border-border p-6">
      <h2 class="text-xl font-bold">Change Password</h2>
    </header>
    <div class="space-y-4 p-6">
      <p class="text-base text-muted-foreground">
        We'll send a password reset link to <strong class="text-foreground">{email}</strong>.
      </p>
      <button
        type="button"
        class="border border-border px-4 py-2 font-bold disabled:opacity-50"
        disabled={resetPending || !email}
        onclick={() => void resetPassword()}
        >{resetPending ? 'Sending...' : 'Send Reset Link'}</button
      >
    </div>
  </section>
  {#if message}<p class:text-destructive={failed} role={failed ? 'alert' : 'status'}>
      {message}
    </p>{/if}
</div>
