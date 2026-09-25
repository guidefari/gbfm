<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { Option, Schema } from 'effect'
  import { onMount } from 'svelte'
  import { clearLocalDraft, readComposerDraft, splitCommaList, writeLocalDraft, type ComposerDraft } from '@/lib/creator/drafts'
  import { uploadImageDirectToS3 } from '@/lib/upload/image-upload'

  const ErrorResponse = Schema.Struct({ message: Schema.optional(Schema.String) })
  const Creator = Schema.Struct({ id: Schema.String })
  const EditablePost = Schema.Struct({
    title: Schema.NullOr(Schema.String),
    slug: Schema.String,
    content: Schema.NullOr(Schema.String),
    description: Schema.NullOr(Schema.String),
    tags: Schema.NullOr(Schema.Array(Schema.String)),
    thumbnailUrl: Schema.NullOr(Schema.String),
    type: Schema.NullOr(Schema.Literals(['post', 'micro'])),
    musicEntityType: Schema.NullOr(Schema.Literals(['album', 'track', 'playlist'])),
    musicEntityId: Schema.NullOr(Schema.String),
    quotedPostId: Schema.NullOr(Schema.String),
    creators: Schema.optional(Schema.Array(Creator))
  })
  const ResolvedMusic = Schema.Struct({
    entityType: Schema.Literals(['album', 'track', 'playlist', 'artist']),
    entity: Schema.Struct({ id: Schema.String })
  })
  const SavedPost = Schema.Struct({ slug: Schema.String })

  type PostPayload = {
    title: string | null
    description: string | undefined
    content: string | null
    slug: string
    thumbnailUrl: string | undefined
    tags: string[]
    draft: boolean
    type: ComposerDraft['type']
    creatorIds: string[]
    musicEntityType: ComposerDraft['musicEntityType'] | null
    musicEntityId: string | null
    quotedPostId?: string | null
  }

  let { userId }: { userId: string } = $props()
  const editSlug = page.url.searchParams.get('edit')
  const draftKey = `gbfm:composer:${editSlug ?? 'new'}`
  const makeInitial = (): ComposerDraft => ({ type: page.url.searchParams.get('mode') === 'editorial' ? 'post' : 'micro', title: '', slug: '', content: '', description: '', tags: '', thumbnailUrl: '', creatorIds: userId, musicUrl: '', musicEntityType: '', musicEntityId: '', quotedPostId: '', externalMediaUrl: '' })
  const initial = makeInitial()
  let form = $state<ComposerDraft>({ ...initial })
  let artworkFile = $state<File | null>(null)
  let artworkPreview = $state('')
  let pending = $state(false), loading = $state(Boolean(editSlug)), error = $state(''), status = $state('Saved')
  let hydrated = $state(false), savedSnapshot = $state(JSON.stringify(initial))
  let reviewing = $state(false)

  const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const messageFrom = async (response: Response) => {
    const text = await response.text()
    try {
      const parsed = Option.getOrNull(Schema.decodeUnknownOption(ErrorResponse)(JSON.parse(text)))
      return parsed?.message ?? text
    } catch {
      return text
    }
  }
  const apply = (value: Partial<ComposerDraft>) => { form = { ...form, ...value }; artworkPreview = form.thumbnailUrl }

  onMount(() => {
    void (async () => {
      try {
        if (editSlug) {
          const response = await fetch(`/api/content/posts/${encodeURIComponent(editSlug)}/edit`)
          if (!response.ok) throw new Error((await messageFrom(response)) || 'Could not load this post.')
          const post = Schema.decodeUnknownSync(EditablePost)(await response.json())
          apply({ type: post.type === 'post' ? 'post' : 'micro', title: post.title ?? '', slug: post.slug, content: post.content ?? '', description: post.description ?? '', tags: (post.tags ?? []).join(', '), thumbnailUrl: post.thumbnailUrl ?? '', creatorIds: (post.creators ?? []).map(({ id }) => id).join(', ') || userId, musicEntityType: post.musicEntityType ?? '', musicEntityId: post.musicEntityId ?? '', quotedPostId: post.quotedPostId ?? '' })
          savedSnapshot = JSON.stringify(form)
        } else {
          const recovered = readComposerDraft(draftKey)
          if (recovered && JSON.stringify(recovered) !== JSON.stringify(initial)) { apply(recovered); status = 'Local draft recovered' }
        }
      } catch (cause) { error = cause instanceof Error ? cause.message : 'Could not load this post.' }
      finally { loading = false; hydrated = true }
    })()
  })

  $effect(() => {
    const snapshot = JSON.stringify(form)
    if (!hydrated || snapshot === savedSnapshot) return
    status = 'Unsaved changes'
    const timer = window.setTimeout(() => { writeLocalDraft(draftKey, form); status = 'Saved locally' }, 2000)
    return () => window.clearTimeout(timer)
  })

  async function resolveMusic() {
    if (!form.musicUrl.trim()) return
    error = ''; status = 'Resolving music…'
    const response = await fetch('/api/music/resolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: form.musicUrl.trim(), origin: form.type === 'post' ? 'editorial' : 'tweet' }) })
    if (!response.ok) { error = (await messageFrom(response)) || 'Could not resolve music link.'; status = 'Unsaved changes'; return }
    const resolved = Schema.decodeUnknownSync(ResolvedMusic)(await response.json())
    if (resolved.entityType === 'artist') { error = 'Artist links cannot be attached to a post.'; return }
    form = { ...form, musicEntityType: resolved.entityType, musicEntityId: resolved.entity.id }; status = 'Music attached'
  }

  function chooseArtwork(input: HTMLInputElement) { const file = input.files?.[0] ?? null; artworkFile = file; if (file) artworkPreview = URL.createObjectURL(file) }
  function insertExternalMedia() { const url = form.externalMediaUrl.trim(); if (url) form = { ...form, content: `${form.content}${form.content ? '\n\n' : ''}${url}`, externalMediaUrl: '' } }

  async function submit(draft: boolean) {
    if (!draft && !confirm(`Publish this ${form.type === 'post' ? 'editorial' : 'tweet'} now?`)) return
    pending = true; error = ''; status = draft ? 'Saving draft…' : 'Publishing…'
    try {
      let thumbnailUrl = form.thumbnailUrl.trim()
      if (artworkFile) thumbnailUrl = (await uploadImageDirectToS3(artworkFile)).url
      const finalSlug = form.slug.trim() || `${slugify(form.title || form.type)}-${Date.now().toString(36)}`
      const creatorIds = splitCommaList(form.creatorIds)
      const payload: PostPayload = { title: form.title.trim() || null, description: form.type === 'post' ? form.description : undefined, content: form.content.trim() || null, slug: finalSlug, thumbnailUrl: form.type === 'post' ? thumbnailUrl || undefined : undefined, tags: splitCommaList(form.tags), draft, type: form.type, creatorIds: creatorIds.length ? creatorIds : [userId], musicEntityType: form.musicEntityType || null, musicEntityId: form.musicEntityId.trim() || null }
      if (!editSlug) payload.quotedPostId = form.quotedPostId.trim() || null
      const response = await fetch(editSlug ? `/api/content/posts/${encodeURIComponent(editSlug)}` : '/api/content/post', { method: editSlug ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      if (!response.ok) throw new Error((await messageFrom(response)) || 'Could not save content.')
      const saved = Schema.decodeUnknownSync(SavedPost)(await response.json())
      form = { ...form, slug: saved.slug, thumbnailUrl }; savedSnapshot = JSON.stringify(form); clearLocalDraft(draftKey); status = draft ? 'Draft saved' : 'Published'
      if (!draft) await goto(form.type === 'post' ? `/editorial/${saved.slug}` : `/tweet/${saved.slug}`)
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Could not save content.'; status = 'Save failed' }
    finally { pending = false }
  }
</script>

<section class="mx-auto max-w-4xl px-4 py-12">
  <header class="flex flex-wrap items-center justify-between gap-4"><div><h1 class="text-4xl font-black">{editSlug ? 'Edit content' : 'New content'}</h1><p class="text-sm text-muted-foreground">{status}</p></div><select bind:value={form.type} class="border bg-background p-2" disabled={Boolean(editSlug)}><option value="micro">Tweet</option><option value="post">Editorial</option></select></header>
  {#if loading}<p class="py-12">Loading…</p>{:else}
    {#if reviewing}
      <article class="mt-8 grid gap-5 border p-6">
        <p class="text-xs font-bold uppercase tracking-[.2em] text-highlight">Publish review</p>
        {#if artworkPreview}<img class="max-h-80 w-full object-cover" src={artworkPreview} alt="Cover preview" />{/if}
        <h2 class="text-3xl font-black">{form.title || 'Untitled'}</h2>
        {#if form.description}<p class="text-muted-foreground">{form.description}</p>{/if}
        <div class="whitespace-pre-wrap">{form.content || 'No body content.'}</div>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt>Format</dt><dd>{form.type === 'post' ? 'Editorial' : 'Tweet'}</dd><dt>Slug</dt><dd>{form.slug || 'Generated on publish'}</dd><dt>Tags</dt><dd>{form.tags || 'None'}</dd><dt>Music</dt><dd>{form.musicEntityId ? `${form.musicEntityType}: ${form.musicEntityId}` : 'None'}</dd><dt>Quote</dt><dd>{form.quotedPostId || 'None'}</dd></dl>
        {#if error}<p role="alert" class="text-destructive">{error}</p>{/if}
        <div class="flex gap-3"><button type="button" class="border p-3" onclick={() => reviewing = false}>Back to editor</button><button type="button" class="bg-primary p-3 font-bold text-primary-foreground" disabled={pending} onclick={() => void submit(false)}>{pending ? 'Publishing…' : 'Publish now'}</button></div>
      </article>
    {:else}<form class="mt-8 grid gap-4" onsubmit={(event) => event.preventDefault()}>
      <label>Title / tweet<textarea class="mt-1 min-h-28 w-full border bg-background p-3" bind:value={form.title} maxlength={form.type === 'micro' ? 280 : undefined} placeholder={form.type === 'micro' ? 'What is happening?' : 'Title'} required></textarea></label>
      <label>Slug<input class="mt-1 w-full border bg-background p-3" bind:value={form.slug} placeholder="Generated from title when blank" /></label>
      <label>Body (Markdown)<textarea class="mt-1 min-h-64 w-full border bg-background p-3" bind:value={form.content} placeholder="Start writing…"></textarea></label>
      {#if form.type === 'post'}<label>Description<textarea class="mt-1 w-full border bg-background p-3" bind:value={form.description}></textarea></label>{/if}
      <label>Tags<input class="mt-1 w-full border bg-background p-3" bind:value={form.tags} placeholder="music, interview" /></label>
      <label>Creator IDs<input class="mt-1 w-full border bg-background p-3" bind:value={form.creatorIds} placeholder="Comma-separated user IDs" /></label>
      {#if form.type === 'post'}
        <fieldset class="grid gap-3 border p-4"><legend>Cover image</legend><input class="border bg-background p-3" bind:value={form.thumbnailUrl} type="url" placeholder="https://…" /><input type="file" accept="image/*" onchange={(event) => chooseArtwork(event.currentTarget)} />{#if artworkPreview}<img class="max-h-64 w-full object-cover" src={artworkPreview} alt="Cover preview" />{/if}</fieldset>
        <fieldset class="grid gap-3 border p-4"><legend>External media</legend><div class="flex gap-2"><input class="min-w-0 flex-1 border bg-background p-3" bind:value={form.externalMediaUrl} type="url" placeholder="YouTube, SoundCloud, Bandcamp URL" /><button type="button" class="border px-4" onclick={insertExternalMedia}>Insert into body</button></div></fieldset>
      {/if}
      <fieldset class="grid gap-3 border p-4"><legend>Music entity</legend><div class="flex gap-2"><input class="min-w-0 flex-1 border bg-background p-3" bind:value={form.musicUrl} type="url" placeholder="Spotify, Apple Music, Bandcamp or Tidal URL" /><button type="button" class="border px-4" onclick={() => void resolveMusic()}>Resolve</button></div>{#if form.musicEntityId}<p class="text-sm">Attached {form.musicEntityType}: {form.musicEntityId}</p>{/if}</fieldset>
      {#if form.type === 'micro'}<label>Quoted tweet ID<input class="mt-1 w-full border bg-background p-3" bind:value={form.quotedPostId} placeholder="UUID of tweet to quote" /></label>{/if}
      {#if error}<p role="alert" class="text-destructive">{error}</p>{/if}
      <div class="flex gap-3"><button type="button" class="border p-3" disabled={pending} onclick={() => void submit(true)}>Save draft</button><button type="button" class="bg-primary p-3 font-bold text-primary-foreground" disabled={pending || (!form.title.trim() && !form.content.trim())} onclick={() => reviewing = true}>Review & publish</button></div>
    </form>
    {/if}
  {/if}
</section>
