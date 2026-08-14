'use client'

import {
  AudioDropZone,
  AudioFileCard,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  generateSlug,
  MixDetailsForm,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  TracklistEditor,
  MixUploadProgress as UploadProgress,
  type MixUploadStep as UploadStep,
  type TrackEntry,
  UploadSummaryCard
} from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createLazyFileRoute, useRouter } from '@tanstack/react-router'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { AlertTriangle, FileText, List, Loader2, Music, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { S3AudioFilePicker, S3MediaFilePicker } from '@/components/mix-uploader/S3AudioFilePicker'
import { SimpleMarkdownEditor } from '@/components/simple-markdown-editor'
import { useMixUploadDraft } from '@/hooks/useMixUploadDraft'
import { type MixUploadDraft } from '@/services/mix-upload-draft'
import { useResumableUpload, type ResumableUploadError } from '@/hooks/useResumableUpload'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { authClient, useSession } from '@/lib/auth-client'
import { apiUrl, useAllShows, useAudioBySlugForEdit, useAudioTags } from '@/lib/http'
import { runAppEffect } from '@/runtime'
import {
  AudioUploadError,
  type ImageUploadError,
  MissingAudioError,
  NotSignedInError,
  TagsUpdateError,
  type RecordSaveError
} from './mix-upload/-errors'
import { type MixFormData, saveRecord, uploadImage } from './mix-upload/-program'
import type { ResumableUploadOutcome } from '@/hooks/useResumableUpload'

type EditType = 'mix' | 'set' | 'live'

const isEditType = (value: string): value is EditType =>
  value === 'mix' || value === 'set' || value === 'live'

type SubmitSuccess = {
  readonly audioUrl: string
  readonly imageUrl: string
  readonly record: unknown
}
type SubmitResult = SubmitSuccess | ResumableUploadOutcome

const isSubmitSuccess = (value: SubmitResult): value is SubmitSuccess =>
  'audioUrl' in value && 'imageUrl' in value && 'record' in value

export const Route = createLazyFileRoute('/mix-upload')({
  component: MixUploadPage
})

const mixUploadSearchSchema = z.object({
  edit: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
  type: z.literal('mix').optional()
})

const describeUploadError = (error: ResumableUploadError): string => {
  if (error._tag === 'NetworkError') {
    return 'Lost connection. We will keep your progress and resume when you are back online.'
  }
  if (error._tag === 'HttpError') {
    if (error.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.status === 403) return 'You do not have permission to upload audio.'
    if (error.status === 413) return 'The audio file is too large. Max size is 200MB.'
    if (error.status === 415) return 'This audio format is not supported.'
    if (error.status >= 500) return 'The server is having trouble. Please try again shortly.'
    return error.message
  }
  if (error._tag === 'InvalidResponseError')
    return 'We received an unexpected response from the server.'
  if (error._tag === 'FileTooLargeError') return 'The audio file is too large. Max size is 200MB.'
  return error.message
}

const describePageError = (
  error:
    | AudioUploadError
    | ImageUploadError
    | RecordSaveError
    | NotSignedInError
    | MissingAudioError
): string => {
  if (error._tag === 'NotSignedInError') return error.message
  if (error._tag === 'MissingAudioError') return error.message
  if (error._tag === 'AudioUploadError') return error.message
  if (error.status === 401) return 'Your session has expired. Please sign in again.'
  if (error.status === 403) return 'You do not have permission to save this content.'
  if (error.status === 413) return 'The image is too large.'
  if (error.status === 415) return 'Unsupported file type.'
  if (error.status && error.status >= 500)
    return 'The server is having trouble. Please try again shortly.'
  if (error.status && error.status >= 400) return error.message
  return error.message
}

const uploadStepFromPhase = (phase: string): UploadStep => {
  if (phase === 'preparing' || phase === 'uploading' || phase === 'finalizing')
    return 'uploading-audio'
  if (phase === 'paused') return 'paused-audio'
  return 'idle'
}

const hasDraftContent = (d: MixUploadDraft): boolean =>
  Boolean(
    d.title ||
    d.description ||
    d.slug ||
    d.content ||
    d.thumbnailUrl ||
    d.tags.length > 0 ||
    d.tracklist.length > 0 ||
    d.url ||
    d.audioFingerprint ||
    d.audioFileName ||
    d.artworkFingerprint ||
    d.artworkFileName ||
    d.showId ||
    d.episodeNumber ||
    d.creatorId
  )

function MixUploadPage() {
  const { data: session } = useSession()
  const user = session?.user
  const parsedSearch = mixUploadSearchSchema.safeParse(Route.useSearch())
  const search = parsedSearch.success ? parsedSearch.data : {}
  const isEditMode = Boolean(search.edit)
  const editType = search.type || 'mix'

  const { data: availableTags } = useAudioTags('mix')
  const { data: allShows } = useAllShows({ limit: 100 })
  const { data: existingMix, isPending: mixLoading } = useAudioBySlugForEdit(
    editType,
    search.edit || ''
  )

  const draftState = useMixUploadDraft()

  const [formData, setFormData] = useState<MixFormData>(() => ({
    title: search.title || '',
    description: search.description || '',
    slug: search.edit || '',
    content: search.content || '',
    thumbnailUrl: search.thumbnailUrl || '',
    tags: search.tags || [],
    tracklist: [],
    draft: true,
    creatorId: undefined,
    url: undefined,
    showId: undefined,
    episodeNumber: undefined
  }))
  const [draftApplied, setDraftApplied] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [s3PickerOpen, setS3PickerOpen] = useState(false)
  const [s3ArtworkPickerOpen, setS3ArtworkPickerOpen] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const router = useRouter()
  const queryClient = useQueryClient()
  const isOnline = useOnlineStatus()
  const submitInFlightRef = useRef(false)

  const resumableUpload = useResumableUpload()

  const isAdmin = user?.role === 'admin'

  const { data: usersData } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => authClient.admin.listUsers({ query: { limit: 100 } }),
    enabled: isAdmin
  })

  const usersList = usersData?.data?.users || []

  useEffect(() => {
    setUploadStep((prev) => {
      const next = uploadStepFromPhase(resumableUpload.state.phase)
      if (next === 'idle' && prev !== 'uploading-audio' && prev !== 'paused-audio') return prev
      return next
    })
  }, [resumableUpload.state.phase])

  useEffect(() => {
    if (draftState.isLoaded && draftState.draft && !draftApplied && !isEditMode) {
      const d = draftState.draft
      if (hasDraftContent(d)) {
        setFormData((prev) => ({
          ...prev,
          title: d.title || prev.title,
          description: d.description || prev.description,
          slug: d.slug || prev.slug,
          content: d.content || prev.content,
          thumbnailUrl: d.thumbnailUrl || prev.thumbnailUrl,
          tags: d.tags.length > 0 ? [...d.tags] : prev.tags,
          tracklist: d.tracklist.length > 0 ? [...d.tracklist] : prev.tracklist,
          showId: d.showId ?? prev.showId,
          episodeNumber: d.episodeNumber ?? prev.episodeNumber,
          creatorId: d.creatorId ?? prev.creatorId,
          url: d.url ?? prev.url
        }))
        if (d.thumbnailUrl) setArtworkPreview(d.thumbnailUrl)
        if (d.url) setAudioPreview(d.url)
        toast({
          title: 'Draft restored',
          description: 'We restored your in-progress mix from your last session.',
          duration: 4000
        })
      }
      setDraftApplied(true)
    } else if (draftState.isLoaded) {
      setDraftApplied(true)
    }
  }, [draftState.isLoaded, draftState.draft, draftApplied, isEditMode])

  useEffect(() => {
    if (!draftApplied) return
    if (isEditMode) return
    draftState.saveDraft({
      title: formData.title,
      description: formData.description,
      slug: formData.slug,
      content: formData.content,
      thumbnailUrl: formData.thumbnailUrl,
      tags: formData.tags,
      tracklist: formData.tracklist,
      showId: formData.showId,
      episodeNumber: formData.episodeNumber,
      creatorId: formData.creatorId,
      url: formData.url,
      audioFile,
      artworkFile
    })
  }, [draftApplied, isEditMode, formData, audioFile, artworkFile, draftState])

  useEffect(() => {
    if (!isOnline) return
    if (resumableUpload.state.phase !== 'paused') return
    if (!audioFile) return
    void resumableUpload.resume(audioFile).then((outcome) => {
      if (outcome._tag === 'Error') {
        toast({
          title: 'Audio upload failed',
          description: describeUploadError(outcome.error),
          variant: 'destructive'
        })
      }
    })
  }, [isOnline, resumableUpload.state.phase, audioFile, resumableUpload])

  useEffect(() => {
    if (existingMix && isEditMode) {
      setFormData((prev) => ({
        ...prev,
        title: existingMix.title || prev.title,
        description: existingMix.description || prev.description,
        slug: existingMix.slug || prev.slug,
        content: existingMix.content || prev.content,
        thumbnailUrl: existingMix.thumbnailUrl || prev.thumbnailUrl,
        tags: existingMix.tags || prev.tags,
        creatorId: existingMix.creators?.[0]?.id || prev.creatorId,
        url: existingMix.url || prev.url,
        showId: existingMix.showId || prev.showId,
        episodeNumber: existingMix.episodeNumber
          ? String(existingMix.episodeNumber)
          : prev.episodeNumber
      }))
      if (existingMix.thumbnailUrl) setArtworkPreview(existingMix.thumbnailUrl)
      if (existingMix.url) setAudioPreview(existingMix.url)
    }
  }, [existingMix, isEditMode])

  const updateTagsMutation = useMutation({
    mutationFn: (tags: string[]) =>
      runAppEffect(
        Effect.tryPromise({
          try: () =>
            fetch(apiUrl(`/content/audio/${editType}/${search.edit}`), {
              method: 'PATCH',
              body: JSON.stringify({ tags })
            }).then(async (res) => {
              if (!res.ok)
                throw new TagsUpdateError({ message: `Tags update failed: ${res.status}` })
              return res.json()
            }),
          catch: (cause) =>
            cause instanceof TagsUpdateError
              ? cause
              : new TagsUpdateError({ message: String(cause) })
        }).pipe(Effect.retry({ times: 2, while: () => false }))
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['audio', editType] })
      void queryClient.invalidateQueries({
        queryKey: ['audio', editType, search.edit]
      })
      toast({ title: 'Tags updated' })
    },
    onError: (err: TagsUpdateError) => {
      toast({
        title: 'Failed to update tags',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const runSubmit = useCallback(
    async (isDraft: boolean, signal: AbortSignal) => {
      const program = Effect.gen(function* () {
        if (!user) {
          return yield* new NotSignedInError({ message: 'Please login/signup to upload content' })
        }
        if (!isEditMode && !audioFile && !formData.url) {
          return yield* new MissingAudioError({
            message: 'Please select an audio file to upload or pick one from S3.'
          })
        }

        let audioUrl = formData.url || ''
        if (audioFile) {
          const outcome = yield* Effect.promise(() => resumableUpload.start(audioFile))
          if (outcome._tag === 'Error') {
            return yield* new AudioUploadError({
              message: describeUploadError(outcome.error)
            })
          }
          if (outcome._tag !== 'Success') {
            return outcome
          }
          audioUrl = outcome.result.url

          yield* Effect.sync(() => {
            setFormData((prev) => ({ ...prev, url: audioUrl }))
            setAudioFile(null)
            if (audioPreview?.startsWith('blob:')) {
              URL.revokeObjectURL(audioPreview)
            }
            setAudioPreview(audioUrl)
          })
        }

        let imageUrl = formData.thumbnailUrl
        if (artworkFile) {
          const result = yield* uploadImage(artworkFile, signal)
          imageUrl = result.url
        }

        const recordInput = {
          userId: user.id,
          formData: { ...formData, url: audioUrl, thumbnailUrl: imageUrl, draft: isDraft },
          imageUrl,
          audioUrl,
          isEditMode,
          editSlug: search.edit || '',
          editType: isEditType(editType) ? editType : 'mix'
        }
        const record = yield* saveRecord(recordInput, signal)
        return { audioUrl, imageUrl, record }
      })

      const exit = await runAppEffect(Effect.exit(program))
      return exit
    },
    [
      user,
      isEditMode,
      audioFile,
      audioPreview,
      formData,
      artworkFile,
      resumableUpload,
      search.edit,
      editType
    ]
  )

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      description: '',
      slug: '',
      content: '',
      thumbnailUrl: '',
      tags: [],
      tracklist: [],
      draft: true,
      creatorId: undefined,
      url: undefined,
      showId: undefined,
      episodeNumber: undefined
    })
    setAudioFile(null)
    setArtworkFile(null)
    if (audioPreview) URL.revokeObjectURL(audioPreview)
    if (artworkPreview) URL.revokeObjectURL(artworkPreview)
    setAudioPreview(null)
    setArtworkPreview(null)
    setUploadStep('idle')
    void draftState.clearDraft()
  }, [audioPreview, artworkPreview, draftState])

  const handleSubmit = useCallback(
    async (isDraft: boolean) => {
      const controller = new AbortController()
      submitInFlightRef.current = true
      setUploadStep('uploading-image')
      let exit: Exit.Exit<
        SubmitResult,
        AudioUploadError | ImageUploadError | RecordSaveError | NotSignedInError | MissingAudioError
      >
      try {
        exit = await runSubmit(isDraft, controller.signal)
      } finally {
        submitInFlightRef.current = false
      }

      if (Exit.isSuccess(exit)) {
        const value = exit.value
        if (isSubmitSuccess(value)) {
          setFormData((prev) => ({ ...prev, url: value.audioUrl, thumbnailUrl: value.imageUrl }))
          if (audioFile) {
            setAudioFile(null)
          }
          await draftState.clearDraft().catch(() => undefined)
          toast({
            title: isEditMode ? 'Update successful!' : 'Upload successful!',
            description: `"${formData.title}" has been ${isEditMode ? 'updated' : 'uploaded'}.`
          })
          setUploadStep('success')
          setTimeout(() => {
            if (!isEditMode) resetForm()
            setUploadStep('idle')

            if (formData.showId) {
              const showSlug = allShows.find((s) => s.id === formData.showId)?.slug
              void router.navigate(
                showSlug ? { to: '/shows/$showSlug', params: { showSlug } } : { to: '/shows' }
              )
            } else if (isEditMode) {
              void router.navigate({
                to: '/mixes/$mixId',
                params: { mixId: formData.slug || search.edit || '' }
              })
            } else {
              void router.navigate({ to: '/shows' })
            }
          }, 2000)
          return
        }
        if (value._tag === 'Paused') {
          toast({
            title: 'Upload paused',
            description: 'Reconnect or resume to continue uploading.',
            variant: 'destructive'
          })
        } else if (value._tag === 'Aborted') {
          toast({ title: 'Upload cancelled', variant: 'destructive' })
        }
        setUploadStep('idle')
        return
      }

      const failure = Cause.findErrorOption(exit.cause)
      if (failure._tag === 'Some') {
        const error = failure.value
        toast({
          title: 'Upload failed',
          description: describePageError(error),
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Upload failed',
          description: 'An unexpected error occurred.',
          variant: 'destructive'
        })
      }
      setUploadStep('idle')
    },
    [
      runSubmit,
      isEditMode,
      audioFile,
      formData,
      allShows,
      router,
      search.edit,
      draftState,
      resetForm
    ]
  )

  const handleCancel = useCallback(async () => {
    await resumableUpload.cancel()
    if (!submitInFlightRef.current) {
      toast({ title: 'Upload cancelled', variant: 'destructive' })
    }
  }, [resumableUpload])

  const handleInputChange = (field: keyof MixFormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }
      if (field === 'title' && !prev.slug) updated.slug = generateSlugIfMissing(value, prev.slug)
      return updated
    })
  }

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAudioFile(file)
      setAudioPreview(URL.createObjectURL(file))
      if (!formData.title) {
        const fileName = file.name.replace(/\.[^/.]+$/, '')
        const cleanTitle = fileName.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
        handleInputChange('title', cleanTitle)
      }
    }
  }

  const handleS3FileSelect = (url: string, filename: string) => {
    if (audioPreview && audioFile) URL.revokeObjectURL(audioPreview)
    setAudioFile(null)
    setAudioPreview(url)
    setFormData((prev) => {
      const updated = { ...prev, url }
      if (!prev.title) {
        const cleanTitle = filename
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())
        updated.title = cleanTitle
        if (!prev.slug) updated.slug = generateSlugIfMissing(cleanTitle, prev.slug)
      }
      return updated
    })
  }

  const handleS3ArtworkSelect = (url: string) => {
    if (artworkPreview && artworkFile) URL.revokeObjectURL(artworkPreview)
    setArtworkFile(null)
    setArtworkPreview(url)
    setFormData((prev) => ({ ...prev, thumbnailUrl: url }))
  }

  const handleArtworkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setArtworkFile(file)
      setArtworkPreview(URL.createObjectURL(file))
    }
  }

  const removeAudioFile = () => {
    setAudioFile(null)
    if (audioPreview && !formData.url) {
      URL.revokeObjectURL(audioPreview)
      setAudioPreview(null)
    } else if (formData.url) {
      setAudioPreview(null)
      setFormData((prev) => ({ ...prev, url: undefined }))
    }
    setFormData((prev) => ({ ...prev, tracklist: [] }))
  }

  const removeArtworkFile = () => {
    setArtworkFile(null)
    if (artworkPreview && !formData.thumbnailUrl) {
      URL.revokeObjectURL(artworkPreview)
      setArtworkPreview(null)
    } else if (formData.thumbnailUrl) {
      setArtworkPreview(null)
      setFormData((prev) => ({ ...prev, thumbnailUrl: '' }))
    }
  }

  const toggleTag = (tag: string) => {
    setFormData((prev) => {
      const newTags = prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag]
      if (isEditMode) updateTagsMutation.mutate(newTags)
      return { ...prev, tags: newTags }
    })
  }

  const addNewTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim()) {
      if (!formData.tags.includes(newTag.trim())) toggleTag(newTag.trim())
      setNewTag('')
    }
  }

  const addTrackTimestamp = () => {
    if (!audioRef.current) return
    const time = Math.floor(audioRef.current.currentTime)
    const newTrack: TrackEntry = {
      id: Date.now(),
      time,
      title: `Track ${formData.tracklist.length + 1}`
    }
    setFormData((prev) => ({
      ...prev,
      tracklist: [...prev.tracklist, newTrack].toSorted((a, b) => a.time - b.time)
    }))
  }

  const updateTrack = (index: number, title: string) => {
    setFormData((prev) => {
      const newList = [...prev.tracklist]
      const existing = newList[index]
      if (existing) {
        newList[index] = { ...existing, title }
      }
      return { ...prev, tracklist: newList }
    })
  }

  const removeTrack = (id: number) => {
    setFormData((prev) => ({
      ...prev,
      tracklist: prev.tracklist.filter((t) => t.id !== id)
    }))
  }

  const seekTo = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds
      void audioRef.current.play()
    }
  }

  const isUploading = uploadStep !== 'idle' && uploadStep !== 'success'

  const progressBadge = useMemo(
    () => ({
      bytesUploaded: resumableUpload.state.bytesUploaded,
      totalBytes: resumableUpload.state.totalBytes,
      currentPart: resumableUpload.state.currentPart,
      totalParts: resumableUpload.state.totalParts
    }),
    [
      resumableUpload.state.bytesUploaded,
      resumableUpload.state.totalBytes,
      resumableUpload.state.currentPart,
      resumableUpload.state.totalParts
    ]
  )

  const hasRestorableDraft = !draftApplied
    ? false
    : draftState.draft !== null && hasDraftContent(draftState.draft)

  if (mixLoading && isEditMode) {
    return (
      <div className='flex items-center justify-center min-h-[50vh]'>
        <Loader2 className='w-8 h-8 animate-spin text-gb-highlight' />
      </div>
    )
  }

  return (
    <div className='px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8'>
      <header className='mb-8'>
        <div className='flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start'>
          <div>
            <h1 className='text-3xl font-bold text-gb-highlight'>
              {isEditMode ? 'Edit DJ Mix' : 'Upload DJ Mix'}
            </h1>
            <p className='pl-0 mt-1 text-gb-default-text'>
              {isEditMode
                ? 'Update your mix details and content.'
                : 'Share your mix with tracklist timestamps for easy navigation.'}
            </p>
          </div>
          {isUploading && <UploadProgress step={uploadStep} audioProgress={progressBadge} />}
        </div>
      </header>

      <S3AudioFilePicker
        open={s3PickerOpen}
        onOpenChange={setS3PickerOpen}
        onSelect={handleS3FileSelect}
      />

      <S3MediaFilePicker
        open={s3ArtworkPickerOpen}
        onOpenChange={setS3ArtworkPickerOpen}
        mediaType='image'
        onSelect={handleS3ArtworkSelect}
      />

      {!draftState.isLoaded && !isEditMode ? (
        <div className='flex items-center justify-center min-h-[40vh]'>
          <Loader2 className='w-8 h-8 animate-spin text-gb-highlight' />
        </div>
      ) : !audioPreview && !isEditMode && !hasRestorableDraft ? (
        <AudioDropZone
          onFileSelect={handleAudioFileChange}
          onPickFromS3={() => setS3PickerOpen(true)}
        />
      ) : (
        <div className='grid grid-cols-1 gap-8 lg:grid-cols-12'>
          <div className='space-y-6 lg:col-span-7'>
            <Tabs defaultValue='details' className='w-full'>
              <TabsList className='w-fit'>
                <TabsTrigger value='details' className='flex items-center gap-2'>
                  <Music className='w-4 h-4' />
                  Details
                </TabsTrigger>
                <TabsTrigger value='tracklist' className='flex items-center gap-2'>
                  <List className='w-4 h-4' />
                  Tracklist
                </TabsTrigger>
                <TabsTrigger value='blog' className='flex items-center gap-2'>
                  <FileText className='w-4 h-4' />
                  Blog Content
                </TabsTrigger>
              </TabsList>

              <TabsContent value='details'>
                <MixDetailsForm
                  title={formData.title}
                  description={formData.description}
                  slug={formData.slug}
                  tags={formData.tags}
                  creatorId={formData.creatorId}
                  showId={formData.showId}
                  episodeNumber={formData.episodeNumber}
                  artworkPreview={artworkPreview}
                  availableTags={availableTags}
                  allShows={allShows}
                  usersList={usersList.map((u) => ({ id: u.id, name: u.name }))}
                  currentUser={user ? { id: user.id, name: user.name } : null}
                  isAdmin={isAdmin}
                  isEditMode={isEditMode}
                  isUpdatingTags={updateTagsMutation.isPending}
                  newTag={newTag}
                  onTitleChange={(v) => handleInputChange('title', v)}
                  onDescriptionChange={(v) => handleInputChange('description', v)}
                  onSlugChange={(v) => handleInputChange('slug', v)}
                  onCreatorChange={(v) => handleInputChange('creatorId', v)}
                  onShowChange={(v) => handleInputChange('showId', v)}
                  onEpisodeNumberChange={(v) => handleInputChange('episodeNumber', v)}
                  onToggleTag={toggleTag}
                  onNewTagChange={setNewTag}
                  onAddNewTag={addNewTag}
                  onArtworkChange={handleArtworkFileChange}
                  onRemoveArtwork={removeArtworkFile}
                  onPickArtworkFromS3={() => setS3ArtworkPickerOpen(true)}
                />
              </TabsContent>

              <TabsContent value='tracklist'>
                <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
                  <CardHeader>
                    <CardTitle className='text-gb-pastel-green-1'>
                      Mark Tracklist Timestamps
                    </CardTitle>
                    <p className='text-base text-muted-foreground'>
                      Play your mix and click "Mark Track Start" when each track begins.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <TracklistEditor
                      tracklist={formData.tracklist}
                      currentTime={currentTime}
                      onAddTrack={addTrackTimestamp}
                      onUpdateTrack={updateTrack}
                      onRemoveTrack={removeTrack}
                      onSeekTo={seekTo}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='blog'>
                <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
                  <CardContent className='pt-6'>
                    <SimpleMarkdownEditor
                      value={formData.content}
                      onChange={(value) => handleInputChange('content', value)}
                      placeholder={`# ${formData.title || 'Your Mix Title'}

## About This Mix
Describe the vibe, inspiration, and journey of your mix...

## Mix Notes
Add any technical details, equipment used, or special techniques...`}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {hasRestorableDraft && !audioPreview && (
              <div
                role='status'
                className='flex items-start gap-3 p-4 border rounded-sm bg-amber-500/10 border-amber-500/30 text-amber-200'>
                <AlertTriangle className='w-5 h-5 mt-0.5 shrink-0' aria-hidden='true' />
                <div className='flex-1 space-y-2'>
                  <p className='font-medium'>Your audio file is no longer available.</p>
                  <p className='text-base text-amber-200/80'>
                    We restored your draft details, but the local audio file can't be recovered
                    after a page reload. Re-select it below to continue.
                  </p>
                  <div className='flex flex-wrap gap-2 pt-1'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => setS3PickerOpen(true)}
                      className='border-amber-500/40 text-amber-100 hover:bg-amber-500/20 hover:text-amber-50'>
                      <Upload className='w-3.5 h-3.5 mr-1.5' />
                      Pick from S3
                    </Button>
                    <label className='inline-flex items-center justify-center h-8 px-3 text-xs font-medium border rounded-sm cursor-pointer border-amber-500/40 text-amber-100 hover:bg-amber-500/20 hover:text-amber-50'>
                      <input
                        type='file'
                        accept='audio/mpeg,audio/wav,audio/aiff,audio/x-aiff'
                        className='sr-only'
                        onChange={handleAudioFileChange}
                      />
                      Choose file
                    </label>
                  </div>
                </div>
              </div>
            )}

            <AudioFileCard
              fileName={audioFile?.name}
              fileSize={audioFile?.size}
              existingUrl={formData.url}
              onRemove={removeAudioFile}
              onPickFromS3={() => setS3PickerOpen(true)}
            />
          </div>

          <div className='lg:col-span-5'>
            <UploadSummaryCard
              audioRef={audioRef}
              audioUrl={audioPreview}
              title={formData.title}
              tags={formData.tags}
              tracklist={formData.tracklist}
              onTimeUpdate={setCurrentTime}
              onPublish={() => handleSubmit(false)}
              onSaveDraft={() => handleSubmit(true)}
              onCancelUpload={handleCancel}
              onDiscard={resetForm}
              isUploading={isUploading}
              uploadStep={uploadStep}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const generateSlugIfMissing = (title: string, currentSlug: string): string => {
  if (currentSlug) return currentSlug
  return generateSlug(title)
}
