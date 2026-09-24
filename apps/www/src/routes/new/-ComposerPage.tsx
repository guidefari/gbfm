'use client'

import { canCreatePosts as roleCanCreatePosts } from '@gbfm/core/roles'
import { normalizeSlugBase } from '@gbfm/core/utils/slug'
import { Button, toast } from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { Loader2, RadioTower } from 'lucide-react'
import { type ChangeEvent, useMemo, useRef, useState } from 'react'
import { MusicEntityPicker } from '@/components/editor/music-entity/MusicEntityPicker'
import { ExternalMediaPickerDialog } from '@/components/editorial/ExternalMediaPickerDialog'
import { useSession } from '@/lib/auth-client'
import {
  apiUrl,
  extractTweetSlugFromText,
  fetcher,
  useMicroPostBySlug,
  usePostTags
} from '@/lib/http'
import { useResolveMusicEntity } from '@/lib/music-entity-resolution'
import { uploadImageDirectToS3 } from '@/lib/upload/image-upload'
import { ComposerCanvas } from './-ComposerCanvas'
import { ComposerHeader } from './-ComposerHeader'
import { MusicSlot } from './-MusicSlot'
import { PublishDialog, type ComposerType } from './-PublishDialog'
import { QuotedTweet } from './-QuotedTweet'
import { TWEET_MAX_LENGTH } from './-tweet-hashtags'
import type { EditorialCreator, EditorialSaveState } from './-editorial-types'
import { useAutosave } from './-useAutosave'
import { useContentEdit } from './-useContentEdit'

type MusicEntityType = 'album' | 'track' | 'playlist'

interface PostItem {
  id: string
  title: string | null
  description: string | null
  slug: string
  content: string | null
  thumbnailUrl: string | null
  tags: string[] | null
  draft: boolean
  type: 'post' | 'micro' | null
  musicEntityType: MusicEntityType | null
  musicEntityId: string | null
  quotedPostId?: string | null
  creators?: Array<{ id: string; name: string; username: string | null }>
}

type MusicEntityPreview = {
  id: string
  title: string
  coverImageUrl: string | null
  slug: string
  artistNames?: string[] | null
}

const entityPathByType = {
  album: 'albums',
  track: 'tracks',
  playlist: 'playlists'
} satisfies Record<MusicEntityType, string>

const MUSIC_URL_PATTERN =
  /https?:\/\/(open\.spotify\.com|music\.apple\.com|[\w-]+\.bandcamp\.com|tidal\.com)\/\S+/i

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function ComposerPage({ editSlug }: { editSlug: string | undefined }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user
  const { data: availableTags } = usePostTags()

  const [type, setType] = useState<ComposerType>('micro')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [slug, setSlug] = useState('')
  const [slugIsManual, setSlugIsManual] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null)
  const [selectedCreators, setSelectedCreators] = useState<EditorialCreator[]>([])
  const [musicUrl, setMusicUrl] = useState('')
  const [pendingMusicCount, setPendingMusicCount] = useState(0)
  const [publishOpen, setPublishOpen] = useState(false)
  const [externalMediaOpen, setExternalMediaOpen] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const savedSlugRef = useRef<string | null>(null)
  const slugBaseRef = useRef<string | null>(null)
  const restoredRef = useRef(false)
  const armedRef = useRef(false)

  const {
    isEditMode,
    data: existingPost,
    isPending: loadingPost
  } = useContentEdit<PostItem>(editSlug)

  const { data: existingMusicEntity } = useQuery<MusicEntityPreview>({
    queryKey: ['music-entity', existingPost?.musicEntityType, existingPost?.musicEntityId],
    queryFn: () =>
      fetcher(
        apiUrl(
          `/music/${entityPathByType[existingPost?.musicEntityType ?? 'track']}/${existingPost?.musicEntityId}`
        )
      ),
    enabled: Boolean(existingPost?.musicEntityType && existingPost.musicEntityId)
  })

  const resolved = useResolveMusicEntity(musicUrl.trim(), 'tweet')
  const quotedSlug = extractTweetSlugFromText(content)
  const resolvedQuote = useMicroPostBySlug(quotedSlug)

  const snapshotOf = (state: {
    title: string
    content: string
    description: string
    tags: string[]
    slug: string
    thumbnailUrl: string
    musicUrl: string
    creators: string[]
  }) => JSON.stringify(state)

  const currentSnapshot = useMemo(
    () =>
      snapshotOf({
        title,
        content,
        description,
        tags,
        slug,
        thumbnailUrl,
        musicUrl,
        creators: selectedCreators.map((creator) => creator.id)
      }),
    [title, content, description, tags, slug, thumbnailUrl, musicUrl, selectedCreators]
  )
  const hasUnsavedChanges = savedSnapshot !== null && savedSnapshot !== currentSnapshot

  if (existingPost && !restoredRef.current) {
    restoredRef.current = true
    savedSlugRef.current = existingPost.slug
    setType(existingPost.type === 'post' ? 'post' : 'micro')
    setTitle(existingPost.title ?? '')
    setContent(existingPost.content ?? '')
    setDescription(existingPost.description ?? '')
    setTags(existingPost.tags ?? [])
    setSlug(existingPost.slug ?? '')
    setSlugIsManual(true)
    setThumbnailUrl(existingPost.thumbnailUrl ?? '')
    setSelectedCreators(existingPost.creators ?? [])
    setSavedSnapshot(
      snapshotOf({
        title: existingPost.title ?? '',
        content: existingPost.content ?? '',
        description: existingPost.description ?? '',
        tags: existingPost.tags ?? [],
        slug: existingPost.slug ?? '',
        thumbnailUrl: existingPost.thumbnailUrl ?? '',
        musicUrl: '',
        creators: (existingPost.creators ?? []).map((creator) => creator.id)
      })
    )
  }

  if (!isEditMode && !armedRef.current && user) {
    armedRef.current = true
    setSelectedCreators([{ id: user.id, name: user.name || 'You' }])
    setSavedSnapshot(currentSnapshot)
  }

  const displayedEntityType = resolved.data?.entityType ?? existingPost?.musicEntityType ?? null
  const displayedEntityTitle = resolved.data?.entity?.title ?? existingMusicEntity?.title ?? null
  const displayedCoverImageUrl =
    resolved.data?.coverImageUrl ?? existingMusicEntity?.coverImageUrl ?? null
  const resolvedArtistNames =
    resolved.data && 'artistNames' in resolved.data.entity ? resolved.data.entity.artistNames : null
  const displayedArtistNames = resolvedArtistNames ?? existingMusicEntity?.artistNames ?? null
  const currentEntityId = resolved.data?.entity?.id ?? existingPost?.musicEntityId ?? null
  const hasEntity = Boolean(displayedEntityType && currentEntityId)
  const entityMeta = [displayedEntityType, displayedArtistNames?.join(', ')]
    .filter(Boolean)
    .join(' · ')

  const canCreatePosts = roleCanCreatePosts(user?.role)
  const isOwnPost = Boolean(existingPost?.creators?.some((creator) => creator.id === user?.id))
  const canAccess = Boolean(
    user && (isEditMode ? user.role === 'admin' || isOwnPost : canCreatePosts)
  )

  const tweetOverLimit = title.length > TWEET_MAX_LENGTH
  const canSave = Boolean(
    (title.trim() || content.trim()) &&
    pendingMusicCount === 0 &&
    !(type === 'micro' && tweetOverLimit)
  )

  function handleTitleChange(value: string) {
    const musicMatch =
      !resolved.data && !musicUrl && !hasEntity ? value.match(MUSIC_URL_PATTERN) : null
    if (musicMatch) {
      setTitle(value.replace(musicMatch[0], '').replace(/[ \t]{2,}/g, ' '))
      setMusicUrl(musicMatch[0])
    } else {
      setTitle(value)
    }
    if (!slugIsManual) setSlug(generateSlug(value))
  }

  function addTag(tag: string) {
    setTags((previous) => Array.from(new Set([...previous, tag])))
  }
  function removeTag(tag: string) {
    setTags((previous) => previous.filter((existing) => existing !== tag))
  }

  function handleArtworkFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setArtworkFile(file)
    setArtworkPreview(URL.createObjectURL(file))
  }
  function removeArtwork() {
    setArtworkFile(null)
    setArtworkPreview(null)
    setThumbnailUrl('')
  }

  const saveMutation = useMutation({
    mutationFn: async ({ draft }: { draft: boolean; silent?: boolean }) => {
      if (!user) throw new Error('Please sign in')

      const persistedSlug = savedSlugRef.current ?? existingPost?.slug ?? null
      let imageUrl = thumbnailUrl
      if (artworkFile) {
        setUploadingImage(true)
        const uploaded = await uploadImageDirectToS3(artworkFile)
        imageUrl = uploaded.url
        setUploadingImage(false)
      }

      if (!slugBaseRef.current) {
        slugBaseRef.current = `${normalizeSlugBase(title.trim() || type) || type}-${Date.now().toString(36)}`
      }
      const finalSlug =
        persistedSlug ??
        (type === 'post' ? slug || generateSlug(title) || slugBaseRef.current : slugBaseRef.current)

      const creatorIds = selectedCreators.map((creator) => creator.id)
      const basePayload = {
        title: title.trim() || null,
        description: type === 'post' ? description : (existingPost?.description ?? undefined),
        slug: finalSlug,
        content: content.trim() ? content : null,
        thumbnailUrl:
          type === 'post' ? imageUrl || null : (existingPost?.thumbnailUrl ?? undefined),
        tags,
        draft,
        type,
        creatorIds: creatorIds.length > 0 ? creatorIds : [user.id]
      }
      const payload =
        type === 'micro'
          ? {
              ...basePayload,
              musicEntityType: resolved.data?.entityType ?? existingPost?.musicEntityType ?? null,
              musicEntityId: resolved.data?.entity?.id ?? existingPost?.musicEntityId ?? null,
              quotedPostId: resolvedQuote.data?.id ?? existingPost?.quotedPostId ?? null
            }
          : basePayload

      const endpoint = persistedSlug
        ? apiUrl(`/content/posts/${persistedSlug}`)
        : apiUrl('/content/post')

      return fetcher<PostItem>(endpoint, {
        method: persistedSlug ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      })
    },
    onSuccess: async (savedPost, variables) => {
      savedSlugRef.current = savedPost.slug
      setSavedSnapshot(currentSnapshot)
      await queryClient.invalidateQueries({ queryKey: ['posts'] })
      await queryClient.invalidateQueries({ queryKey: ['post', editSlug] })

      if (variables.draft) return

      toast({ title: type === 'post' ? 'Post published' : 'Tweet captured' })
      void router.navigate(
        type === 'post'
          ? { to: '/editorial/$slug', params: { slug: savedPost.slug } }
          : { to: '/tweet/$slug', params: { slug: savedPost.slug } }
      )
    },
    onError: (error, variables) => {
      setUploadingImage(false)
      if (variables.silent) return
      toast({
        variant: 'destructive',
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Something went wrong'
      })
    }
  })

  useAutosave({
    enabled:
      hasUnsavedChanges && canSave && !saveMutation.isPending && (existingPost?.draft ?? true),
    dirtyKey: currentSnapshot,
    onSave: () => saveMutation.mutate({ draft: true, silent: true })
  })

  const saveState: EditorialSaveState = saveMutation.isPending
    ? uploadingImage
      ? 'uploading'
      : 'saving'
    : saveMutation.isError
      ? 'error'
      : hasUnsavedChanges
        ? 'unsaved'
        : 'saved'

  if (loadingPost && isEditMode) {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className='mr-2 size-6 animate-spin' />
        Loading…
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className='flex min-h-[50vh] items-center justify-center p-4'>
        <div className='text-center'>
          <p className='mb-4 text-lg text-muted-foreground'>
            {!user ? 'Please sign in to write a post' : 'You can only edit posts you created'}
          </p>
          <Link
            to={!user ? '/auth/sign-in' : '/'}
            className='inline-flex items-center justify-center rounded-sm bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:bg-primary/90'>
            {!user ? 'Sign In' : 'Go Home'}
          </Link>
        </div>
      </div>
    )
  }

  const navigation =
    isEditMode && existingPost ? (
      <Link
        to={existingPost.type === 'post' ? '/editorial/$slug' : '/tweet/$slug'}
        params={{ slug: existingPost.slug }}
        className='text-xs text-muted-foreground hover:text-foreground'>
        Back to post
      </Link>
    ) : null

  return (
    <div className='text-foreground'>
      <ComposerHeader
        navigation={navigation}
        saveState={saveState}
        isSaving={saveMutation.isPending}
        canSave={canSave}
        primaryLabel='Continue'
        onDiscard={() => {
          setTitle('')
          setContent('')
          setDescription('')
          setTags([])
          setMusicUrl('')
        }}
        onPublish={() => setPublishOpen(true)}
      />

      <ComposerCanvas
        title={title}
        titlePlaceholder='Title'
        content={content}
        tags={tags}
        availableTags={availableTags}
        contentPlaceholder='Start writing…'
        resolutionScope='editorial'
        onTitleChange={handleTitleChange}
        onContentChange={setContent}
        onAddTag={addTag}
        onPendingMusicChange={setPendingMusicCount}
        musicSlot={
          <MusicSlot
            hasEntity={hasEntity}
            musicUrl={musicUrl}
            isResolving={resolved.isLoading}
            coverImageUrl={displayedCoverImageUrl}
            entityTitle={displayedEntityTitle}
            entityMeta={entityMeta}
            onMusicUrlChange={setMusicUrl}
            onClear={() => setMusicUrl('')}
          />
        }
        editorToolbarActions={(insertBlock) => (
          <>
            <MusicEntityPicker onInsert={insertBlock} portalContainer={null} />
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => setExternalMediaOpen(true)}
              className='h-9 gap-1.5 px-2 text-xs'>
              <RadioTower className='size-4' />
              Media
            </Button>
            <ExternalMediaPickerDialog
              open={externalMediaOpen}
              portalContainer={null}
              onOpenChange={setExternalMediaOpen}
              onInsert={insertBlock}
            />
          </>
        )}
        belowEditorSlot={
          <QuotedTweet
            slug={quotedSlug}
            isPending={resolvedQuote.isPending}
            title={resolvedQuote.data?.title}
            content={resolvedQuote.data?.content}
          />
        }
      />

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        type={type}
        onTypeChange={setType}
        title={title}
        content={content}
        tags={tags}
        availableTags={availableTags}
        isSaving={saveMutation.isPending}
        canPublish={canSave}
        isEditMode={isEditMode}
        tweetOverLimit={tweetOverLimit}
        tweetCount={title.length}
        description={description}
        slug={slug}
        thumbnailUrl={thumbnailUrl}
        artworkPreview={artworkPreview}
        artworkFile={artworkFile}
        selectedCreators={selectedCreators}
        coverImageUrl={displayedCoverImageUrl}
        entityTitle={displayedEntityTitle}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onDescriptionChange={setDescription}
        onSlugChange={(value) => {
          setSlugIsManual(true)
          setSlug(value)
        }}
        onThumbnailUrlChange={setThumbnailUrl}
        onArtworkFileChange={handleArtworkFileChange}
        onRemoveArtwork={removeArtwork}
        onCreatorChange={(creators) => setSelectedCreators(creators.slice(-1))}
        onPublish={() => saveMutation.mutate({ draft: false })}
      />
    </div>
  )
}
