'use client'

import {
  AudioDropZone,
  AudioFileCard,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type TrackEntry,
  TracklistEditor,
  toast,
  MixUploadProgress as UploadProgress,
  type MixUploadStep as UploadStep
} from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createLazyFileRoute, useRouter } from '@tanstack/react-router'
import { FileText, List, Loader2, Music } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MixDetailsForm } from '@/components/mix-uploader/MixDetailsForm'
import { S3AudioFilePicker } from '@/components/mix-uploader/S3AudioFilePicker'
import { UploadSummaryCard } from '@/components/mix-uploader/upload-summary-card'
import { SimpleMarkdownEditor } from '@/components/simple-markdown-editor'
import { formatTime, generateSlug } from '@/hooks/useFileUpload'
import { authClient } from '@/lib/auth-client'
import {
  fetcher,
  useAllShows,
  useAudioBySlug,
  useAudioByType,
  VPS_BASE_URL
} from '@/lib/http'
import { useAuthStore } from '@/store'

export const Route = createLazyFileRoute('/mix-upload')({
  component: MixUploadPage
})

interface MixFormData {
  title: string
  description: string
  slug: string
  content: string
  thumbnailUrl: string
  tags: string[]
  tracklist: TrackEntry[]
  draft: boolean
  creatorId?: string
  url?: string
  showId?: string
  episodeNumber?: string
}

function MixUploadPage() {
  const { user } = useAuthStore()
  const search = Route.useSearch() as {
    edit?: string
    title?: string
    description?: string
    content?: string
    thumbnailUrl?: string
    tags?: string[]
    type?: string
  }
  const isEditMode = Boolean(search.edit)
  const editType = (search.type as 'mix') || 'mix'

  const { data: allMixes } = useAudioByType('mix')
  const { data: allShows } = useAllShows()

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    allMixes?.forEach((mix) => {
      mix.tags?.forEach((t: string) => {
        tagSet.add(t)
      })
    })
    return Array.from(tagSet).sort()
  }, [allMixes])

  const { data: existingMix, isPending: mixLoading } = useAudioBySlug(
    editType,
    search.edit || ''
  )

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
  const [newTag, setNewTag] = useState('')
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [s3PickerOpen, setS3PickerOpen] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const router = useRouter()
  const queryClient = useQueryClient()

  const isAdmin = user?.role === 'admin'

  const { data: usersData } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => authClient.admin.listUsers({ query: { limit: 100 } }),
    enabled: isAdmin
  })

  const usersList = usersData?.data?.users || []

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
      fetcher(`${VPS_BASE_URL}/content/audio/${editType}/${search.edit}`, {
        method: 'PATCH',
        body: JSON.stringify({ tags })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audio', editType] })
      queryClient.invalidateQueries({
        queryKey: ['audio', editType, search.edit]
      })
      toast({ title: 'Tags updated' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to update tags',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const uploadMutation = useMutation({
    mutationFn: async (
      data: MixFormData & { audioFile: File | null; artworkFile: File | null }
    ) => {
      if (!user) {
        toast({
          title: 'Please login/signup to upload content',
          variant: 'destructive'
        })
        return
      }

      setUploadStep('uploading-audio')

      let audioUrl = data.url || ''
      if (data.audioFile) {
        const uploadFormData = new FormData()
        uploadFormData.append('audioFile', data.audioFile)
        uploadFormData.append('fileType', 'audio')

        const audioUploadResponse = await fetch(`${VPS_BASE_URL}/upload/file`, {
          method: 'POST',
          body: uploadFormData
        })

        if (!audioUploadResponse.ok) throw new Error('Failed to upload audio')
        const audioResult = await audioUploadResponse.json()
        audioUrl = audioResult.url
      }

      setUploadStep('uploading-image')

      let imageUrl = data.thumbnailUrl
      if (data.artworkFile) {
        const imageFormData = new FormData()
        imageFormData.append('imageFile', data.artworkFile)
        imageFormData.append('fileType', 'image')

        const imageUploadResponse = await fetch(`${VPS_BASE_URL}/upload/file`, {
          method: 'POST',
          body: imageFormData
        })

        if (!imageUploadResponse.ok) throw new Error('Failed to upload image')
        const imageResult = await imageUploadResponse.json()
        imageUrl = imageResult.url
      }

      setUploadStep('creating-record')

      const tracklistMarkdown =
        data.tracklist.length > 0
          ? `\n\n## Tracklist\n${data.tracklist
              .map((t, i) => `${i + 1}. ${t.title} (${formatTime(t.time)})`)
              .join('\n')}`
          : ''

      const audioData = {
        title: data.title,
        description: data.description,
        slug: data.slug || generateSlug(data.title),
        content: data.content + tracklistMarkdown,
        thumbnailUrl: imageUrl,
        url: audioUrl,
        type: 'mix',
        tags: data.tags,
        creatorIds: [
          data.creatorId === 'current' ? user?.id : data.creatorId || user?.id
        ].filter(Boolean),
        showId: data.showId,
        episodeNumber: data.episodeNumber ? Number(data.episodeNumber) : null
      }

      const endpoint = isEditMode
        ? `${VPS_BASE_URL}/content/audio/${editType}/${search.edit}`
        : `${VPS_BASE_URL}/content/audio`

      const result = await fetcher(endpoint, {
        method: isEditMode ? 'PATCH' : 'POST',
        body: JSON.stringify(audioData)
      })

      setUploadStep('success')
      return result
    },
    onSuccess: () => {
      toast({
        title: isEditMode ? 'Update successful!' : 'Upload successful!',
        description: `"${formData.title}" has been ${isEditMode ? 'updated' : 'uploaded'}.`
      })

      setTimeout(() => {
        if (!isEditMode) resetForm()
        setUploadStep('idle')

        if (formData.showId) {
          router.navigate({ to: '/shows' })
        } else {
          router.navigate({
            to: isEditMode ? `/mixes/${search.edit}` : '/mixes'
          })
        }
      }, 2000)
    },
    onError: (error) => {
      toast({
        title: 'Upload failed',
        description:
          error instanceof Error ? error.message : 'An unexpected error.',
        variant: 'destructive'
      })
      setUploadStep('idle')
    }
  })

  const handleInputChange = (field: keyof MixFormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }
      if (field === 'title' && !prev.slug) updated.slug = generateSlug(value)
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
        const cleanTitle = fileName
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())
        handleInputChange('title', cleanTitle)
      }
    }
  }

  const handleS3FileSelect = (url: string, filename: string) => {
    setAudioPreview(url)
    setFormData((prev) => {
      const updated = { ...prev, url }
      if (!prev.title) {
        const cleanTitle = filename
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())
        updated.title = cleanTitle
        if (!prev.slug) updated.slug = generateSlug(cleanTitle)
      }
      return updated
    })
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
      tracklist: [...prev.tracklist, newTrack].sort((a, b) => a.time - b.time)
    }))
  }

  const updateTrack = (index: number, title: string) => {
    setFormData((prev) => {
      const newList = [...prev.tracklist]
      newList[index].title = title
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
      audioRef.current.play()
    }
  }

  const handleSubmit = (isDraft: boolean) => {
    if (!isEditMode && !audioFile && !formData.url) {
      toast({
        title: 'Audio file required',
        description:
          'Please select an audio file to upload or pick one from S3.',
        variant: 'destructive'
      })
      return
    }
    uploadMutation.mutate({
      ...formData,
      draft: isDraft,
      audioFile,
      artworkFile
    })
  }

  const resetForm = () => {
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
  }

  const isUploading = uploadStep !== 'idle' && uploadStep !== 'success'

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
          {isUploading && <UploadProgress step={uploadStep} />}
        </div>
      </header>

      <S3AudioFilePicker
        open={s3PickerOpen}
        onOpenChange={setS3PickerOpen}
        onSelect={handleS3FileSelect}
      />

      {!audioPreview && !isEditMode ? (
        <AudioDropZone
          onFileSelect={handleAudioFileChange}
          onPickFromS3={() => setS3PickerOpen(true)}
        />
      ) : (
        <div className='grid grid-cols-1 gap-8 lg:grid-cols-12'>
          <div className='space-y-6 lg:col-span-7'>
            <Tabs defaultValue='details' className='w-full'>
              <TabsList className='w-fit'>
                <TabsTrigger
                  value='details'
                  className='flex items-center gap-2'>
                  <Music className='w-4 h-4' />
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value='tracklist'
                  className='flex items-center gap-2'>
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
                  usersList={usersList.map((u) => ({
                    id: u.id,
                    name: u.name
                  }))}
                  currentUser={
                    user
                      ? {
                          id: user.id,
                          name: user.name
                        }
                      : null
                  }
                  isAdmin={isAdmin}
                  isEditMode={isEditMode}
                  isUpdatingTags={updateTagsMutation.isPending}
                  newTag={newTag}
                  onTitleChange={(v) => handleInputChange('title', v)}
                  onDescriptionChange={(v) =>
                    handleInputChange('description', v)
                  }
                  onSlugChange={(v) => handleInputChange('slug', v)}
                  onCreatorChange={(v) => handleInputChange('creatorId', v)}
                  onShowChange={(v) => handleInputChange('showId', v)}
                  onEpisodeNumberChange={(v) =>
                    handleInputChange('episodeNumber', v)
                  }
                  onToggleTag={toggleTag}
                  onNewTagChange={setNewTag}
                  onAddNewTag={addNewTag}
                  onArtworkChange={handleArtworkFileChange}
                  onRemoveArtwork={removeArtworkFile}
                />
              </TabsContent>

              <TabsContent value='tracklist'>
                <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
                  <CardHeader>
                    <CardTitle className='text-gb-pastel-green-1'>
                      Mark Tracklist Timestamps
                    </CardTitle>
                    <p className='text-sm text-muted-foreground'>
                      Play your mix and click "Mark Track Start" when each track
                      begins.
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

            <AudioFileCard
              fileName={audioFile?.name}
              fileSize={audioFile?.size}
              existingUrl={formData.url}
              onRemove={removeAudioFile}
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
