'use client'

import { toast } from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useRouter, useSearch } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  type ChangeEvent,
  type MouseEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react'
import { useSession } from '@/lib/auth-client'
import { apiUrl, fetcher } from '@/lib/http'
import { uploadImageDirectToS3 } from '@/lib/upload/image-upload'
import { EditorialMetadataPanel } from './-EditorialMetadataSidebar'
import type {
  EditorialCreator,
  EditorialFormData,
  EditorialTextField,
  EditorialPost,
  EditorialSaveState
} from './-editorial-types'
import { EditorialWorkspaceHeader } from './-EditorialWorkspaceHeader'
import { EditorialWritingCanvas } from './-EditorialWritingCanvas'

interface EditorialSaveRequest {
  formData: EditorialFormData
  artworkFile: File | null
  creatorIds: string[]
}

function createEmptyFormData(): EditorialFormData {
  return {
    title: '',
    description: '',
    slug: '',
    content: '',
    thumbnailUrl: '',
    tags: [],
    draft: false
  }
}

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function toPostFormData(post: EditorialPost): EditorialFormData {
  return {
    title: post.title || '',
    description: post.description || '',
    slug: post.slug || '',
    content: post.content || '',
    thumbnailUrl: post.thumbnailUrl || '',
    tags: post.tags || [],
    draft: post.draft ?? false
  }
}

function createEditorSnapshot(
  formData: EditorialFormData,
  creatorIds: string[],
  artworkFile: File | null
) {
  return JSON.stringify({
    formData,
    creatorIds,
    artwork: artworkFile
      ? { name: artworkFile.name, size: artworkFile.size, lastModified: artworkFile.lastModified }
      : null
  })
}

export function EditorialPage() {
  const search = useSearch({ from: '/new/editorial' })
  const isEditMode = Boolean(search.edit)
  const queryClient = useQueryClient()
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user
  const artworkUploadId = useId()
  const workspaceRef = useRef<HTMLDialogElement>(null)
  const initializedNewCreator = useRef(false)

  const [formData, setFormData] = useState<EditorialFormData>(createEmptyFormData)
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null)
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading-image' | 'saving'>('idle')
  const [selectedCreators, setSelectedCreators] = useState<EditorialCreator[]>([])
  const [pendingMusicCount, setPendingMusicCount] = useState(0)
  const [slugIsManual, setSlugIsManual] = useState(isEditMode)
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)

  const { data: existingPost, isPending: loadingPost } = useQuery({
    queryKey: ['post', search.edit],
    queryFn: () => fetcher<EditorialPost>(apiUrl(`/content/posts/${search.edit}/edit`)),
    enabled: isEditMode && Boolean(search.edit)
  })

  useEffect(() => {
    if (!existingPost) return
    const nextFormData = toPostFormData(existingPost)
    const nextCreators = existingPost.creators || []
    setFormData(nextFormData)
    setSelectedCreators(nextCreators)
    setSlugIsManual(true)
    setSavedSnapshot(
      createEditorSnapshot(
        nextFormData,
        nextCreators.map((creator) => creator.id),
        null
      )
    )
  }, [existingPost])

  useEffect(() => {
    if (isEditMode || !user || initializedNewCreator.current) return
    const defaultCreator = { id: user.id, name: user.name || 'You' }
    const initialFormData = createEmptyFormData()
    setSelectedCreators([defaultCreator])
    setSavedSnapshot(createEditorSnapshot(initialFormData, [defaultCreator.id], null))
    initializedNewCreator.current = true
  }, [isEditMode, user])

  useEffect(() => {
    return () => {
      if (artworkPreview) URL.revokeObjectURL(artworkPreview)
    }
  }, [artworkPreview])

  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace || workspace.open) return () => {}

    workspace.showModal()
    return () => workspace.close()
  }, [])

  const currentSnapshot = useMemo(
    () =>
      createEditorSnapshot(
        formData,
        selectedCreators.map((creator) => creator.id),
        artworkFile
      ),
    [artworkFile, formData, selectedCreators]
  )
  const hasUnsavedChanges = savedSnapshot !== null && currentSnapshot !== savedSnapshot
  const canSave = Boolean(
    formData.title.trim() && formData.content.trim() && pendingMusicCount === 0
  )

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    if (hasUnsavedChanges) {
      window.addEventListener('beforeunload', warnBeforeUnload)
    }

    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [hasUnsavedChanges])

  const saveMutation = useMutation({
    mutationFn: async ({
      formData: submittedFormData,
      artworkFile: submittedArtworkFile,
      creatorIds
    }: EditorialSaveRequest) => {
      if (!user) {
        throw new Error('Please sign in to edit content')
      }

      let imageUrl = submittedFormData.thumbnailUrl
      if (submittedArtworkFile) {
        setUploadStep('uploading-image')
        const imageResult = await uploadImageDirectToS3(submittedArtworkFile)
        imageUrl = imageResult.url
      }

      setUploadStep('saving')

      const generatedSlug = submittedFormData.slug || generateSlug(submittedFormData.title)
      const payload = {
        title: submittedFormData.title.trim() || null,
        description: submittedFormData.description,
        slug: generatedSlug || `post-${Date.now().toString(36)}`,
        content: submittedFormData.content.trim() ? submittedFormData.content : null,
        thumbnailUrl: imageUrl || null,
        tags: submittedFormData.tags,
        draft: submittedFormData.draft,
        type: 'post',
        creatorIds: creatorIds.length > 0 ? creatorIds : [user.id]
      }

      const endpoint = isEditMode
        ? apiUrl(`/content/posts/${search.edit}`)
        : apiUrl('/content/post')

      return fetcher<EditorialPost>(endpoint, {
        method: isEditMode ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      })
    },
    onSuccess: async (savedPost, savedRequest) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['post', search.edit] }),
        queryClient.invalidateQueries({
          queryKey: ['post', 'editorial', savedPost.slug]
        }),
        queryClient.invalidateQueries({ queryKey: ['posts', 'editorials'] }),
        queryClient.invalidateQueries({ queryKey: ['posts', 'tags'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'posts', 'post'] })
      ])

      const persistedFormData = toPostFormData(savedPost)
      const persistedCreators = savedPost.creators?.length ? savedPost.creators : selectedCreators

      setFormData(persistedFormData)
      setSelectedCreators(persistedCreators)
      setSlugIsManual(true)
      setArtworkFile(null)
      setArtworkPreview(null)
      setSavedSnapshot(
        createEditorSnapshot(
          persistedFormData,
          persistedCreators.map((creator) => creator.id),
          null
        )
      )
      setUploadStep('idle')
      toast({
        title: savedRequest.formData.draft ? 'Draft saved' : 'Post published',
        description: `${savedPost.title || savedPost.slug} saved successfully.`
      })

      if (savedRequest.formData.draft) {
        if (!isEditMode) {
          void router.navigate({
            to: '/new/editorial',
            search: { edit: savedPost.id },
            replace: true
          })
        }
        return
      }

      setTimeout(() => {
        void router.navigate({
          to: '/editorial/$slug',
          params: { slug: savedPost.slug }
        })
      }, 500)
    },
    onError: (error) => {
      toast({
        title: 'Failed to save post',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive'
      })
      setUploadStep('idle')
    }
  })

  const saveState: EditorialSaveState = saveMutation.isPending
    ? uploadStep === 'uploading-image'
      ? 'uploading'
      : 'saving'
    : saveMutation.isError
      ? 'error'
      : hasUnsavedChanges
        ? 'unsaved'
        : 'saved'

  function handleArtworkFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setArtworkFile(file)
    setArtworkPreview(URL.createObjectURL(file))
  }

  function removeArtwork() {
    setArtworkFile(null)
    setArtworkPreview(null)
    setFormData((previous) => ({ ...previous, thumbnailUrl: '' }))
  }

  function handleTextInputChange(field: EditorialTextField, value: string) {
    if (field === 'slug') setSlugIsManual(true)

    setFormData((previous) => {
      const updated = { ...previous, [field]: value }
      if (field === 'title' && !slugIsManual) {
        updated.slug = generateSlug(value)
      }
      return updated
    })
  }

  function handleCreatorChange(creators: EditorialCreator[]) {
    const mostRecentCreator = creators.at(-1)
    setSelectedCreators(mostRecentCreator ? [mostRecentCreator] : [])
  }

  function handleSave(draft: boolean) {
    const nextFormData = { ...formData, draft }
    setFormData(nextFormData)
    saveMutation.mutate({
      formData: nextFormData,
      artworkFile,
      creatorIds: selectedCreators.map((creator) => creator.id)
    })
  }

  function handleDiscard() {
    if (hasUnsavedChanges && !window.confirm('Discard your unsaved editorial changes?')) return

    const nextFormData = existingPost ? toPostFormData(existingPost) : createEmptyFormData()
    const nextCreators = existingPost?.creators || selectedCreators
    setFormData(nextFormData)
    setSelectedCreators(nextCreators)
    setSlugIsManual(Boolean(existingPost))
    setArtworkFile(null)
    setArtworkPreview(null)
    setSavedSnapshot(
      createEditorSnapshot(
        nextFormData,
        nextCreators.map((creator) => creator.id),
        null
      )
    )
  }

  function confirmNavigation(event: MouseEvent<HTMLAnchorElement>) {
    if (
      hasUnsavedChanges &&
      !window.confirm('Leave this page and discard unsaved editorial changes?')
    ) {
      event.preventDefault()
    }
  }

  if (isEditMode && loadingPost) {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className='mr-2 size-6 animate-spin' />
        Loading post…
      </div>
    )
  }

  const navigation =
    isEditMode && existingPost ? (
      <div className='flex items-center gap-3 text-xs text-muted-foreground'>
        <Link
          to='/editorial/$slug'
          params={{ slug: existingPost.slug }}
          onClick={confirmNavigation}
          className='inline-flex items-center gap-1 hover:text-foreground'>
          <ArrowLeft className='size-3.5' />
          Back to post
        </Link>
        <Link
          to='/new/tweet'
          search={{ edit: undefined }}
          onClick={confirmNavigation}
          className='hover:text-foreground'>
          Tweet capture
        </Link>
      </div>
    ) : (
      <Link
        to='/new/tweet'
        search={{ edit: undefined }}
        onClick={confirmNavigation}
        className='text-xs text-muted-foreground hover:text-foreground'>
        Switch to tweet capture
      </Link>
    )

  const metadata = (
    <EditorialMetadataPanel
      formData={formData}
      artworkFile={artworkFile}
      artworkPreview={artworkPreview}
      artworkUploadId={artworkUploadId}
      selectedCreators={selectedCreators}
      onArtworkFileChange={handleArtworkFileChange}
      onRemoveArtwork={removeArtwork}
      onThumbnailUrlChange={(value) => handleTextInputChange('thumbnailUrl', value)}
      onSlugChange={(value) => handleTextInputChange('slug', value)}
      onAddTag={(tag) =>
        setFormData((previous) => ({
          ...previous,
          tags: Array.from(new Set([...previous.tags, tag]))
        }))
      }
      onRemoveTag={(tag) =>
        setFormData((previous) => ({
          ...previous,
          tags: previous.tags.filter((existing) => existing !== tag)
        }))
      }
      onCreatorChange={handleCreatorChange}
    />
  )

  return (
    <dialog
      ref={workspaceRef}
      onCancel={(event) => event.preventDefault()}
      className='m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto border-0 bg-background p-0 px-4 text-foreground backdrop:bg-background sm:px-6 lg:px-8'>
      <EditorialWorkspaceHeader
        title={isEditMode ? 'Edit editorial' : 'New editorial'}
        navigation={navigation}
        saveState={saveState}
        isSaving={saveMutation.isPending}
        canSave={canSave}
        onDiscard={handleDiscard}
        onSaveDraft={() => handleSave(true)}
        onPublish={() => handleSave(false)}
      />

      <div className='mx-auto max-w-4xl'>
        <EditorialWritingCanvas
          formData={formData}
          metadata={metadata}
          onInputChange={handleTextInputChange}
          onPendingMusicChange={setPendingMusicCount}
        />
      </div>
    </dialog>
  )
}
