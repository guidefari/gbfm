'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createLazyFileRoute, useRouter } from '@tanstack/react-router'
import {
  FileText,
  ImageIcon,
  List,
  Loader2,
  Music,
  Tag,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  type TrackEntry,
  TracklistEditor
} from '@/components/mix-uploader/tracklist-editor'
import { UploadSummaryCard } from '@/components/mix-uploader/upload-summary-card'
import { SimpleMarkdownEditor } from '@/components/simple-markdown-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import {
  fetcher,
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
}

function MixUploadPage() {
  const search = Route.useSearch() as {
    edit?: string
    title?: string
    description?: string
    content?: string
    thumbnailUrl?: string
    tags?: string[]
  }
  const isEditMode = !!search.edit

  const { data: allMixes } = useAudioByType('mix')
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
    'mix',
    search.edit || ''
  )

  const [formData, setFormData] = useState<MixFormData>(() => ({
    title: search.title || '',
    description: search.description || '',
    slug: search.edit || '', // Use the edit slug as the base slug
    content: search.content || '',
    thumbnailUrl: search.thumbnailUrl || '',
    tags: search.tags || [],
    tracklist: [],
    draft: true
  }))
  const [newTag, setNewTag] = useState('')
  const [uploadStep, setUploadStep] = useState<
    | 'idle'
    | 'uploading-audio'
    | 'uploading-image'
    | 'creating-record'
    | 'success'
  >('idle')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)

  const audioRef = useRef<HTMLAudioElement>(null)
  const { user } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (existingMix && isEditMode) {
      setFormData((prev) => ({
        ...prev,
        title: existingMix.title || prev.title,
        description: existingMix.description || prev.description,
        slug: existingMix.slug || prev.slug,
        content: existingMix.content || prev.content,
        thumbnailUrl: existingMix.thumbnailUrl || prev.thumbnailUrl,
        tags: existingMix.tags || prev.tags
      }))
      if (existingMix.thumbnailUrl) {
        setArtworkPreview(existingMix.thumbnailUrl)
      }
    }
  }, [existingMix, isEditMode])

  const updateTagsMutation = useMutation({
    mutationFn: (tags: string[]) =>
      fetcher(`${VPS_BASE_URL}/content/audio/mix/${search.edit}`, {
        method: 'PATCH',
        body: JSON.stringify({ tags })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audio', 'mix'] })
      queryClient.invalidateQueries({ queryKey: ['audio', 'mix', search.edit] })
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

  const artworkUploadId = useId()

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

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

      const uploadFormData = new FormData()

      let audioUrl = data.audioFile
        ? ''
        : (data as MixFormData & { url?: string }).url || '' // Keep existing URL if no new file
      if (data.audioFile) {
        uploadFormData.append('audioFile', data.audioFile)
        uploadFormData.append('fileType', 'audio')

        const audioUploadResponse = await fetch(`${VPS_BASE_URL}/upload/file`, {
          method: 'POST',
          body: uploadFormData
        })

        if (!audioUploadResponse.ok) {
          throw new Error('Failed to upload audio file')
        }

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

        if (!imageUploadResponse.ok) {
          throw new Error('Failed to upload image file')
        }

        const imageResult = await imageUploadResponse.json()
        imageUrl = imageResult.url
      }

      setUploadStep('creating-record')

      const tracklistMarkdown =
        data.tracklist.length > 0
          ? `\\n\\n## Tracklist\\n${data.tracklist
              .map((t, i) => `${i + 1}. ${t.title} (${formatTime(t.time)})`)
              .join('\\n')}`
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
        creatorIds: [user?.id]
      }

      const endpoint = isEditMode
        ? `${VPS_BASE_URL}/content/audio/mix/${search.edit}`
        : `${VPS_BASE_URL}/content/audio`

      const method = isEditMode ? 'PATCH' : 'POST'

      const result = await fetcher(endpoint, {
        method,
        body: JSON.stringify(audioData)
      })

      setUploadStep('success')
      return result
    },
    onSuccess: () => {
      toast({
        title: isEditMode ? 'Update successful!' : 'Upload successful!',
        description: `"${formData.title}" has been ${isEditMode ? 'updated' : 'uploaded'} successfully.`
      })

      setTimeout(() => {
        if (!isEditMode) {
          setFormData({
            title: '',
            description: '',
            slug: '',
            content: '',
            thumbnailUrl: '',
            tags: [],
            tracklist: [],
            draft: true
          })
          setAudioFile(null)
          setArtworkFile(null)
          setAudioPreview(null)
          setArtworkPreview(null)
        }
        setUploadStep('idle')

        router.navigate({ to: isEditMode ? `/mixes/${search.edit}` : '/mixes' })
      }, 2000)
    },
    onError: (error) => {
      console.error('Upload failed:', error)
      toast({
        title: 'Upload failed',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.',
        variant: 'destructive'
      })
      setUploadStep('idle')
    }
  })

  const handleInputChange = (field: keyof MixFormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }
      if (field === 'title' && !prev.slug) {
        updated.slug = generateSlug(value)
      }
      return updated
    })
  }

  const handleAudioFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      setAudioFile(file)
      const url = URL.createObjectURL(file)
      setAudioPreview(url)

      if (!formData.title) {
        const fileName = file.name.replace(/\.[^/.]+$/, '')
        const cleanTitle = fileName
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())
        handleInputChange('title', cleanTitle)
      }
    }
  }

  const handleArtworkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setArtworkFile(file)
      const url = URL.createObjectURL(file)
      setArtworkPreview(url)
    }
  }

  const removeAudioFile = () => {
    setAudioFile(null)
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview)
      setAudioPreview(null)
    }
    setFormData((prev) => ({ ...prev, tracklist: [] }))
  }

  const removeArtworkFile = () => {
    setArtworkFile(null)
    if (artworkPreview) {
      URL.revokeObjectURL(artworkPreview)
      setArtworkPreview(null)
    }
  }

  const toggleTag = (tag: string) => {
    setFormData((prev) => {
      const newTags = prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag]

      if (isEditMode) {
        updateTagsMutation.mutate(newTags)
      }

      return { ...prev, tags: newTags }
    })
  }

  const addNewTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim()) {
      if (!formData.tags.includes(newTag.trim())) {
        toggleTag(newTag.trim())
      }
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

  const handleSubmit = async (isDraft: boolean) => {
    if (!isEditMode && !audioFile) {
      toast({
        title: 'Audio file required',
        description: 'Please select an audio file to upload.',
        variant: 'destructive'
      })
      return
    }

    const submitData = {
      ...formData,
      draft: isDraft,
      audioFile: isEditMode ? null : audioFile, // Don't require audio file for edits
      artworkFile
    }
    uploadMutation.mutate(submitData)
  }

  const handleDiscard = () => {
    setFormData({
      title: '',
      description: '',
      slug: '',
      content: '',
      thumbnailUrl: '',
      tags: [],
      tracklist: [],
      draft: true
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
          {isUploading && (
            <div className='w-full p-4 border rounded-sm md:w-64 bg-gb-darker-bg border-gb-pastel-green-2/20'>
              <div className='flex justify-between mb-2 text-sm'>
                <span className='font-medium text-gb-pastel-green-1'>
                  Uploading Mix...
                </span>
                <Loader2 className='w-4 h-4 animate-spin text-gb-highlight' />
              </div>
              <div className='w-full h-2 rounded-sm bg-gb-bg'>
                <div
                  className='h-2 transition-all duration-300 rounded-sm bg-gb-highlight'
                  style={{
                    width:
                      uploadStep === 'creating-record'
                        ? '80%'
                        : uploadStep === 'uploading-image'
                          ? '60%'
                          : uploadStep === 'uploading-audio'
                            ? '30%'
                            : '10%'
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {!audioFile && !isEditMode ? (
        <div className='relative p-12 text-center transition-colors border-2 border-dashed cursor-pointer group rounded-sm bg-gb-darker-bg border-gb-pastel-green-2/30 hover:border-gb-highlight/50'>
          <input
            type='file'
            accept='audio/*'
            onChange={handleAudioFileChange}
            className='absolute inset-0 opacity-0 cursor-pointer'
          />
          <div className='flex items-center justify-center w-16 h-16 mx-auto mb-4 transition-transform rounded-sm bg-gb-pastel-green-2/20 group-hover:scale-110'>
            <Upload className='w-8 h-8 text-gb-highlight' />
          </div>
          <h2 className='mb-2 text-xl font-semibold text-gb-pastel-green-1'>
            Select your mix file
          </h2>
          <p className='text-muted-foreground'>
            MP3, WAV, or AIFF supported. Title will be inferred automatically.
          </p>
        </div>
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
                <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
                  <CardContent className='pt-6 space-y-6'>
                    <div className='space-y-2'>
                      <Label className='text-gb-pastel-green-1'>
                        Mix Title
                      </Label>
                      <Input
                        value={formData.title}
                        onChange={(e) =>
                          handleInputChange('title', e.target.value)
                        }
                        placeholder='Summer Solstice Set 2024'
                        className='bg-gb-bg border-gb-pastel-green-2/30'
                      />
                    </div>

                    <div className='space-y-2'>
                      <Label className='text-gb-pastel-green-1'>
                        Short Description
                      </Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) =>
                          handleInputChange('description', e.target.value)
                        }
                        placeholder='A deep dive into progressive sounds recorded live...'
                        className='bg-gb-bg border-gb-pastel-green-2/30'
                      />
                    </div>

                    <div className='space-y-2'>
                      <Label className='text-gb-pastel-green-1'>URL Slug</Label>
                      <Input
                        value={formData.slug}
                        onChange={(e) =>
                          handleInputChange('slug', e.target.value)
                        }
                        placeholder='url-friendly-slug'
                        className='bg-gb-bg border-gb-pastel-green-2/30'
                      />
                      {formData.title && !formData.slug && (
                        <p className='text-xs text-muted-foreground'>
                          Will be: {generateSlug(formData.title)}
                        </p>
                      )}
                    </div>

                    <div className='space-y-2'>
                      <Label className='text-gb-pastel-green-1'>
                        Genre Tags
                        {updateTagsMutation.isPending && isEditMode && (
                          <Loader2 className='inline w-3 h-3 ml-2 animate-spin' />
                        )}
                      </Label>
                      <div className='flex flex-wrap gap-2 mb-4'>
                        {availableTags.map((tag) => (
                          <button
                            key={tag}
                            type='button'
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-all ${
                              formData.tags.includes(tag)
                                ? 'bg-gb-pastel-green-2 border-gb-pastel-green-2 text-gb-darker-bg'
                                : 'bg-transparent border-gb-pastel-green-2/30 text-gb-default-text hover:border-gb-highlight/50'
                            }`}>
                            {tag}
                          </button>
                        ))}
                      </div>
                      <div className='relative'>
                        <Tag className='absolute w-4 h-4 left-3 top-3.5 text-muted-foreground' />
                        <Input
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={addNewTag}
                          placeholder='Add custom tag (Press Enter)'
                          className='pl-10 bg-gb-bg border-gb-pastel-green-2/30'
                        />
                      </div>
                      {formData.tags.length > 0 && (
                        <div className='flex flex-wrap gap-2 mt-3'>
                          {formData.tags
                            .filter((tag) => !availableTags.includes(tag))
                            .map((tag) => (
                              <Badge
                                key={tag}
                                variant='secondary'
                                className='flex items-center gap-1 bg-gb-pastel-green-2/20 text-gb-pastel-green-1'>
                                {tag}
                                <X
                                  className='w-3 h-3 cursor-pointer hover:text-gb-highlight'
                                  onClick={() => toggleTag(tag)}
                                />
                              </Badge>
                            ))}
                        </div>
                      )}
                    </div>

                    <div className='space-y-2'>
                      <Label className='text-gb-pastel-green-1'>Artwork</Label>
                      {!artworkFile && !artworkPreview ? (
                        <div className='p-4 text-center transition-colors border-2 border-dashed rounded-sm border-gb-pastel-green-2/30 hover:border-gb-highlight/50'>
                          <ImageIcon className='w-6 h-6 mx-auto mb-2 text-gb-pastel-green-2' />
                          <p className='mb-2 text-xs text-muted-foreground'>
                            Upload cover artwork
                          </p>
                          <input
                            type='file'
                            accept='image/*'
                            onChange={handleArtworkFileChange}
                            className='hidden'
                            id={artworkUploadId}
                          />
                          <label htmlFor={artworkUploadId}>
                            <Button
                              variant='outline'
                              size='sm'
                              className='bg-transparent cursor-pointer border-gb-pastel-green-2/30 text-gb-pastel-green-1 hover:bg-gb-pastel-green-2/20'
                              asChild>
                              <span>
                                <Upload className='w-4 h-4 mr-2' />
                                Choose Image
                              </span>
                            </Button>
                          </label>
                        </div>
                      ) : (
                        <div className='space-y-3'>
                          <div className='relative overflow-hidden border rounded-sm aspect-square bg-gb-bg border-gb-pastel-green-2/20 max-w-[200px]'>
                            <img
                              src={artworkPreview || ''}
                              alt='Artwork preview'
                              className='object-cover w-full h-full'
                            />
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={removeArtworkFile}
                              className='absolute text-white top-2 right-2 bg-black/50 hover:bg-black/70'>
                              <X className='w-4 h-4' />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
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

            <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
              <CardHeader>
                <CardTitle className='flex items-center text-gb-pastel-green-1'>
                  <Music className='w-5 h-5 mr-2' />
                  Audio File
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='flex items-center justify-between p-3 rounded-sm bg-gb-bg'>
                  <div className='flex items-center min-w-0 space-x-3'>
                    <Music className='flex-shrink-0 w-6 h-6 text-gb-highlight' />
                    <div className='min-w-0'>
                      <p className='font-medium leading-tight text-gb-pastel-green-1'>
                        {audioFile?.name || 'Unknown file'}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {audioFile
                          ? (audioFile.size / (1024 * 1024)).toFixed(2)
                          : '0'}{' '}
                        MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={removeAudioFile}
                    className='flex-shrink-0 text-red-400 hover:text-red-300'>
                    <Trash2 className='w-4 h-4' />
                  </Button>
                </div>
              </CardContent>
            </Card>
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
              onDiscard={handleDiscard}
              isUploading={isUploading}
              uploadStep={uploadStep}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
