<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { Option, Schema } from 'effect'
  import { onMount } from 'svelte'
  import { clearLocalDraft, readMixDraft, splitCommaList, writeLocalDraft, type MixDraft } from '@/lib/creator/drafts'
  import { computeFileFingerprint } from '@/lib/upload/resumable-upload'
  import { uploadImageDirectToS3 } from '@/lib/upload/image-upload'
  import { runAppEffect } from '@/runtime'
  import { cancelProgram, readCheckpoint, uploadProgram, type PersistedResumableUpload, type UploadProgress } from '@/services/resumable-upload'

  const ErrorResponse = Schema.Struct({ message: Schema.optional(Schema.String) })

  const EditableMix = Schema.Struct({
    title: Schema.String,
    slug: Schema.String,
    description: Schema.NullOr(Schema.String),
    content: Schema.String,
    tags: Schema.NullOr(Schema.Array(Schema.String)),
    thumbnailUrl: Schema.NullOr(Schema.String),
    url: Schema.String,
    draft: Schema.Boolean,
    showId: Schema.NullOr(Schema.String),
    episodeNumber: Schema.NullOr(Schema.Number),
    creators: Schema.optional(Schema.Array(Schema.Struct({ id: Schema.String })))
  })

  const SavedMix = Schema.Struct({ slug: Schema.String })

  const Show = Schema.Struct({ id: Schema.String, title: Schema.String, slug: Schema.String })

  const ShowList = Schema.Struct({ data: Schema.optional(Schema.Array(Show)), items: Schema.optional(Schema.Array(Show)) })

  type MixPayload = {
    title: string
    slug: string
    description: string
    content: string
    thumbnailUrl: string
    url: string
    type: 'mix'
    draft: boolean
    tags: Array<string>
    creatorIds: Array<string>
    showId: string | undefined
    episodeNumber: number | undefined
    idempotencyKey?: string
  }

  type EditorMixDraft = MixDraft & {
    tracklist: Array<{ id: number; time: number; title: string }>
  }

  let { userId }: { userId: string } = $props()

  const editSlug = page.url.searchParams.get('edit')

  const draftKey = `gbfm:mix:${editSlug ?? 'new'}`

  const makeInitial = (): EditorMixDraft => ({ title: '', slug: '', description: '', content: '', tags: '', thumbnailUrl: '', audioUrl: '', creatorId: userId, showId: '', episodeNumber: '', draft: true, tracklist: [] })

  const initial = makeInitial()

  let form = $state<EditorMixDraft>({ ...initial })

  let audioFile = $state<File | null>(null), audioPreview = $state(''), artworkFile = $state<File | null>(null), artworkPreview = $state('')

  let pending = $state(false), loading = $state(Boolean(editSlug)), paused = $state(false), progress = $state(0), error = $state(''), status = $state('Saved')

  let checkpoint = $state<PersistedResumableUpload | null>(null), controller = $state<AbortController | null>(null), hydrated = $state(false)

  let savedSnapshot = $state(JSON.stringify(initial))

  let tab = $state<'details' | 'tracklist' | 'notes' | 'review'>('details')

  let currentTime = $state(0)

  let shows = $state<ReadonlyArray<typeof Show.Type>>([])

  const messageFrom = async (response: Response) => {
    const text = await response.text()

    try {
      const parsed = Option.getOrNull(Schema.decodeUnknownOption(ErrorResponse)(JSON.parse(text)))

      return parsed?.message ?? text
    } catch {
      return text
    }
  }

  const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  onMount(() => {
    void (async () => {
      try {
        const showsResponse = await fetch('/api/shows?limit=100&offset=0')

        if (showsResponse.ok) {
          const list = Schema.decodeUnknownSync(ShowList)(await showsResponse.json())
          shows = list.data ?? list.items ?? []
        }

        if (editSlug) {
          const response = await fetch(`/api/content/audio/mix/${encodeURIComponent(editSlug)}/edit`)

          if (!response.ok) throw new Error((await messageFrom(response)) || 'Could not load this mix.')
          const mix = Schema.decodeUnknownSync(EditableMix)(await response.json())
          form = { title: mix.title, slug: mix.slug, description: mix.description ?? '', content: mix.content, tags: (mix.tags ?? []).join(', '), thumbnailUrl: mix.thumbnailUrl ?? '', audioUrl: mix.url, draft: mix.draft, showId: mix.showId ?? '', episodeNumber: mix.episodeNumber?.toString() ?? '', creatorId: mix.creators?.[0]?.id ?? userId, tracklist: [] }
          artworkPreview = form.thumbnailUrl; savedSnapshot = JSON.stringify(form)
        } else {
          const recovered = readMixDraft(draftKey)

          if (recovered && JSON.stringify(recovered) !== JSON.stringify(initial)) { form = { ...recovered, tracklist: [] }; artworkPreview = form.thumbnailUrl; status = 'Local draft recovered' }
        }
      } catch (cause) { error = cause instanceof Error ? cause.message : 'Could not load this mix.' }
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

  async function chooseAudio(input: HTMLInputElement) {
    audioFile = input.files?.[0] ?? null

    if (audioFile) audioPreview = URL.createObjectURL(audioFile)
    checkpoint = audioFile ? await runAppEffect(readCheckpoint(computeFileFingerprint(audioFile))) : null

    if (checkpoint) { progress = Math.round(checkpoint.completedParts.reduce((total, part) => total + part.size, 0) / checkpoint.totalBytes * 100); status = 'Upload checkpoint found — resume when ready' }
  }

  function chooseArtwork(input: HTMLInputElement) { const file = input.files?.[0] ?? null; artworkFile = file;

 if (file) artworkPreview = URL.createObjectURL(file) }

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`

  function addTrack() { form = { ...form, tracklist: [...form.tracklist, { id: Date.now(), time: Math.floor(currentTime), title: `Track ${form.tracklist.length + 1}` }].toSorted((a, b) => a.time - b.time) } }

  function updateTrack(id: number, title: string) { form = { ...form, tracklist: form.tracklist.map((track) => track.id === id ? { ...track, title } : track) } }

  function removeTrack(id: number) { form = { ...form, tracklist: form.tracklist.filter((track) => track.id !== id) } }

  async function uploadAudio(): Promise<string | null> {
    if (!audioFile) return form.audioUrl || null
    paused = false; controller = new AbortController(); pending = true; status = checkpoint ? 'Resuming audio upload…' : 'Uploading audio…'

    try {
      const callbacks = { signal: controller.signal, isPaused: () => paused, onCheckpoint: (value: PersistedResumableUpload) => { checkpoint = value }, onProgress: (value: UploadProgress) => { progress = value.totalBytes ? Math.round(value.bytesUploaded / value.totalBytes * 100) : 0 } }
      const options = checkpoint ? { ...callbacks, checkpoint } : callbacks
      const result = await runAppEffect(uploadProgram({ file: audioFile, fileType: 'audio' }, options))
      form = { ...form, audioUrl: result.url }; checkpoint = null; progress = 100; status = 'Audio uploaded';

 return result.url
    } catch (cause) {
      if (paused) { status = 'Upload paused';

 return null }

      if (controller.signal.aborted) { status = 'Upload stopped';

 return null }

      throw cause
    } finally { pending = false; controller = null }
  }

  function pauseUpload() { paused = true; status = 'Pausing after the current part…' }

  async function cancelUpload() {
    controller?.abort()

    if (checkpoint) await runAppEffect(cancelProgram(checkpoint, new AbortController().signal))
    checkpoint = null; progress = 0; paused = false; status = 'Upload cancelled'
  }

  async function submit(draft: boolean) {
    if (!draft && !confirm('Publish this mix now?')) return
    error = ''

    try {
      const audioUrl = await uploadAudio()

      if (!audioUrl) { if (!paused) error = 'Choose an audio file or provide an existing audio URL.';

 return }

      pending = true; status = draft ? 'Saving draft…' : 'Publishing…'
      let thumbnailUrl = form.thumbnailUrl.trim()

      if (artworkFile) thumbnailUrl = (await uploadImageDirectToS3(artworkFile)).url
      const slug = form.slug.trim() || slugify(form.title)
      const tracklist = form.tracklist.length ? `\n\n## Tracklist\n${form.tracklist.map((track, index) => `${index + 1}. ${track.title} (${formatTime(track.time)})`).join('\n')}` : ''
      const payload: MixPayload = { title: form.title.trim(), slug, description: form.description, content: form.content + tracklist, thumbnailUrl, url: audioUrl, type: 'mix', draft, tags: splitCommaList(form.tags), creatorIds: [form.creatorId.trim() || userId], showId: form.showId.trim() || undefined, episodeNumber: form.episodeNumber ? Number(form.episodeNumber) : undefined }

      if (!editSlug) payload.idempotencyKey = crypto.randomUUID()
      const response = await fetch(editSlug ? `/api/content/audio/mix/${encodeURIComponent(editSlug)}` : '/api/content/audio', { method: editSlug ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })

      if (!response.ok) throw new Error((await messageFrom(response)) || 'The mix record could not be saved.')
      const saved = Schema.decodeUnknownSync(SavedMix)(await response.json())
      form = { ...form, slug: saved.slug, audioUrl, thumbnailUrl, draft }; savedSnapshot = JSON.stringify(form); clearLocalDraft(draftKey); status = draft ? 'Draft saved' : 'Published'

      if (!draft) await goto(`/mixes/${saved.slug}`)
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Upload failed.'; status = 'Save failed' }
    finally { pending = false }
  }
</script>

<section class="mx-auto max-w-3xl px-4 py-12">
  <h1 class="text-4xl font-black">{editSlug ? 'Edit mix' : 'Upload a mix'}</h1><p class="mt-2 text-sm text-muted-foreground">{status} · Audio uploads retain a local multipart checkpoint.</p>
  {#if loading}<p class="py-12">Loading…</p>{:else}<form class="mt-8 grid gap-4" onsubmit={(event) => event.preventDefault()}>
    <nav class="flex flex-wrap gap-2" aria-label="Mix editor sections">{#each [['details','Details'],['tracklist','Tracklist'],['notes','Blog content'],['review','Review']] as item}<button type="button" class:font-bold={tab === item[0]} class="border px-3 py-2" onclick={() => tab = item[0] as typeof tab}>{item[1]}</button>{/each}</nav>
    {#if tab === 'details'}
      <label>Title<input class="mt-1 w-full border bg-background p-3" bind:value={form.title} required /></label><label>Slug<input class="mt-1 w-full border bg-background p-3" bind:value={form.slug} placeholder="Generated from title" /></label>
      <label>Description<textarea class="mt-1 w-full border bg-background p-3" bind:value={form.description}></textarea></label><label>Tags<input class="mt-1 w-full border bg-background p-3" bind:value={form.tags} placeholder="house, live" /></label><label>Creator ID<input class="mt-1 w-full border bg-background p-3" bind:value={form.creatorId} /></label>
      <div class="grid gap-4 sm:grid-cols-2"><label>Show (optional)<select class="mt-1 w-full border bg-background p-3" bind:value={form.showId}><option value="">No show</option>{#each shows as show}<option value={show.id}>{show.title}</option>{/each}</select></label><label>Episode number<input class="mt-1 w-full border bg-background p-3" bind:value={form.episodeNumber} type="number" min="1" /></label></div>
      <fieldset class="grid gap-3 border p-4"><legend>Audio</legend>{#if form.audioUrl}<input class="border bg-background p-3" bind:value={form.audioUrl} type="url" aria-label="Existing audio URL" />{/if}<input type="file" accept="audio/mpeg,audio/wav,audio/aiff,audio/x-aiff" onchange={(event) => void chooseAudio(event.currentTarget)} />{#if pending || checkpoint}<progress class="w-full" max="100" value={progress}>{progress}%</progress><p>{progress}% {status}</p><div class="flex gap-2">{#if pending}<button type="button" class="border p-2" onclick={pauseUpload}>Pause</button>{:else if audioFile}<button type="button" class="border p-2" onclick={() => void uploadAudio()}>Resume upload</button>{/if}<button type="button" class="border p-2" onclick={() => void cancelUpload()}>Cancel upload</button></div>{/if}</fieldset>
      <fieldset class="grid gap-3 border p-4"><legend>Artwork</legend><input class="border bg-background p-3" bind:value={form.thumbnailUrl} type="url" placeholder="Cover image URL" /><input type="file" accept="image/*" onchange={(event) => chooseArtwork(event.currentTarget)} />{#if artworkPreview}<img class="max-h-64 w-full object-cover" src={artworkPreview} alt="Cover preview" />{/if}</fieldset>
    {:else if tab === 'tracklist'}
      <p class="text-muted-foreground">Play the mix and mark each track as it starts.</p>{#if audioFile || form.audioUrl}<audio class="w-full" controls src={audioPreview || form.audioUrl} ontimeupdate={(event) => currentTime = event.currentTarget.currentTime}></audio>{:else}<p role="status" class="border p-4">Choose audio in Details before building a tracklist.</p>{/if}
      <button type="button" class="w-fit border p-3" disabled={!audioFile && !form.audioUrl} onclick={addTrack}>Mark track start at {formatTime(currentTime)}</button>
      <ol class="grid gap-2">{#each form.tracklist as track}<li class="flex items-center gap-2"><button type="button" class="w-16 text-left underline" onclick={() => currentTime = track.time}>{formatTime(track.time)}</button><input class="min-w-0 flex-1 border bg-background p-2" value={track.title} oninput={(event) => updateTrack(track.id, event.currentTarget.value)} /><button type="button" class="text-destructive" onclick={() => removeTrack(track.id)}>Remove</button></li>{/each}</ol>
    {:else if tab === 'notes'}<label>Blog content (Markdown)<textarea class="mt-1 min-h-80 w-full border bg-background p-3" bind:value={form.content} placeholder="# About this mix"></textarea></label>
    {:else}<article class="grid gap-4 border p-5">{#if artworkPreview}<img class="max-h-72 w-full object-cover" src={artworkPreview} alt="Mix cover preview" />{/if}<h2 class="text-3xl font-black">{form.title || 'Untitled mix'}</h2><p>{form.description || 'No description yet.'}</p><dl class="grid grid-cols-2 gap-2 text-sm"><dt>Audio</dt><dd>{audioFile?.name ?? form.audioUrl ?? 'Missing'}</dd><dt>Tracks</dt><dd>{form.tracklist.length}</dd><dt>Show</dt><dd>{shows.find(({id}) => id === form.showId)?.title ?? 'None'}</dd><dt>Tags</dt><dd>{form.tags || 'None'}</dd></dl></article>{/if}
    {#if error}<p role="alert" class="text-destructive">{error}</p>{/if}<div class="flex gap-3"><button type="button" class="border p-3" disabled={pending || !form.title.trim()} onclick={() => void submit(true)}>Save draft</button>{#if tab === 'review'}<button type="button" class="bg-primary p-3 font-bold text-primary-foreground" disabled={pending || !form.title.trim()} onclick={() => void submit(false)}>{pending ? 'Working…' : 'Publish mix'}</button>{:else}<button type="button" class="bg-primary p-3 font-bold text-primary-foreground" disabled={!form.title.trim()} onclick={() => tab = 'review'}>Review & publish</button>{/if}</div>
  </form>{/if}
</section>
