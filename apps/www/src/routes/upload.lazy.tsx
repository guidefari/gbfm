'use client'

import { useMutation } from '@tanstack/react-query'
import { createLazyFileRoute, Link, useRouter } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle,
  Disc3,
  ImageIcon,
  List,
  Loader2,
  Music,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import type React from 'react'
import { useEffect, useId, useState } from 'react'
import { SimpleMarkdownEditor } from '@/components/simple-markdown-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { fetcher, useAudioBySlug, VPS_BASE_URL } from '@/lib/http'
import { useAuthStore } from '@/store'

export const Route = createLazyFileRoute('/upload')({
  component: UploadPage
})

type ContentType = 'mix' | 'track' | 'misc'

interface AudioFormData {
  title: string
  description: string
  slug: string
  type: ContentType
  content: string
  thumbnailUrl: string
  tags: string[]
  draft: boolean
}

const CONTENT_TYPE_CONFIG = {
  mix: {
    icon: Disc3,
    title: 'DJ Mix',
    description: 'A continuous set blending multiple tracks together',
    features: [
      'Tracklist timestamps',
      'Seamless transitions',
      'Long-form content'
    ],
    color: 'gb-highlight'
  },
  track: {
    icon: Music,
    title: 'Track',
    description: 'A single song or production',
    features: ['Production credits', 'BPM & key info', 'Short-form content'],
    color: 'gb-pastel-green-1'
  },
  misc: {
    icon: Sparkles,
    title: 'Other',
    description: 'Podcasts, samples, sound design, etc.',
    features: ['Flexible format', 'Any audio type', 'Custom metadata'],
    color: 'gb-pastel-green-2'
  }
}

function UploadPage() {
  const search = Route.useSearch() as {
    edit?: string | boolean
    archetype?: ContentType
    id?: string
  }
  const isEditMode =
    (search.edit === 'true' || search.edit === true) &&
    search.archetype &&
    search.id

  const editQuery = useAudioBySlug(search.archetype || 'mix', search.id || '')

  const [selectedType, setSelectedType] = useState<ContentType | null>(
    isEditMode ? (search.archetype as ContentType) : null
  )
  const [formData, setFormData] = useState<AudioFormData>({
    title: '',
    description: '',
    slug: '',
    type: 'track',
    content: '',
    thumbnailUrl: '',
    tags: [],
    draft: true
  })
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

  const { user } = useAuthStore()
  const router = useRouter()

  const audioUploadId = useId()
  const titleId = useId()
  const descriptionId = useId()
  const slugId = useId()
  const artworkUploadId = useId()

  useEffect(() => {
    if (isEditMode && editQuery.data && !editQuery.isPending) {
      const data = editQuery.data
      setFormData({
        title: data.title,
        description: data.description || '',
        slug: data.slug,
        type: data.type || 'mix',
        content: data.content,
        thumbnailUrl: data.thumbnailUrl || '',
        tags: data.tags || [],
        draft: data.draft
      })
      setSelectedType(data.type || 'mix')
    }
  }, [isEditMode, editQuery.data, editQuery.isPending])

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const uploadMutation = useMutation({
    mutationFn: async (
      data: AudioFormData & { audioFile: File | null; artworkFile: File | null }
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

      let audioUrl = ''
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

      const audioData = {
        title: data.title,
        description: data.description,
        slug: data.slug || generateSlug(data.title),
        content: data.content,
        thumbnailUrl: imageUrl,
        url: audioUrl || editQuery.data?.url,
        type: data.type,
        tags: data.tags,
        creatorIds: [user?.id]
      }

      const result = await fetcher(
        isEditMode
          ? `${VPS_BASE_URL}/content/audio/${search.archetype}/${search.id}`
          : `${VPS_BASE_URL}/content/audio`,
        {
          method: isEditMode ? 'PATCH' : 'POST',
          body: JSON.stringify(audioData)
        }
      )

      setUploadStep('success')
      return result
    },
    onSuccess: () => {
      toast({
        title: isEditMode ? 'Update successful!' : 'Upload successful!',
        description: `"${formData.title}" has been ${isEditMode ? 'updated' : 'uploaded'} successfully.`
      })

      setTimeout(() => {
        setFormData({
          title: '',
          description: '',
          slug: '',
          type: 'track',
          content: '',
          thumbnailUrl: '',
          tags: [],
          draft: true
        })
        setAudioFile(null)
        setArtworkFile(null)
        setAudioPreview(null)
        setArtworkPreview(null)
        setUploadStep('idle')
        setSelectedType(null)

        router.navigate({ to: '/tracks' })
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

  const handleInputChange = (field: keyof AudioFormData, value: string) => {
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
  }

  const removeArtworkFile = () => {
    setArtworkFile(null)
    if (artworkPreview) {
      URL.revokeObjectURL(artworkPreview)
      setArtworkPreview(null)
    }
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove)
    }))
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

    const submitData = { ...formData, draft: isDraft, audioFile, artworkFile }
    uploadMutation.mutate(submitData)
  }

  const handleSelectType = (type: ContentType) => {
    setSelectedType(type)
    setFormData((prev) => ({ ...prev, type }))
  }

  const getUploadStepText = () => {
    switch (uploadStep) {
      case 'uploading-audio':
        return 'Uploading audio file...'
      case 'uploading-image':
        return 'Uploading artwork...'
      case 'creating-record':
        return 'Creating audio record...'
      case 'success':
        return 'Upload completed successfully!'
      default:
        return 'Processing upload...'
    }
  }

  const isUploading = uploadStep !== 'idle' && uploadStep !== 'success'

  const getTypeLabel = (type: string) => {
    return CONTENT_TYPE_CONFIG[type as ContentType]?.title || type
  }

  const getPlaceholderContent = (type: string) => {
    switch (type) {
      case 'mix':
        return `# ${formData.title || 'Your Mix Title'}

## About This Mix
Describe the vibe, inspiration, and journey of your mix...

## Tracklist
1. Artist - Track Name (00:00)
2. Artist - Track Name (05:30)
3. Artist - Track Name (10:15)

## Mix Notes
Add any technical details, equipment used, or special techniques...`
      case 'track':
        return `# ${formData.title || 'Your Track Title'}

## About This Track
Tell the story behind your track, the inspiration, and creative process...

## Production Notes
- DAW:
- Key:
- BPM:
- Genre:

## Credits
- Produced by:
- Mixed by:
- Mastered by:`
      default:
        return `# ${formData.title || 'Your Audio Title'}

## Description
Tell us about this audio piece...

## Details
Add any relevant information, credits, or notes...`
    }
  }

  if (!selectedType && !isEditMode) {
    return (
      <div className='px-4 py-8 mx-auto max-w-4xl sm:px-6 lg:px-8'>
        <div className='mb-8 text-center'>
          <h1 className='text-3xl font-bold text-gb-highlight'>Upload Audio</h1>
          <p className='mt-2 text-gb-default-text'>
            What type of content are you uploading?
          </p>
        </div>

        <div className='grid gap-6 md:grid-cols-3'>
          {(
            Object.entries(CONTENT_TYPE_CONFIG) as [
              ContentType,
              typeof CONTENT_TYPE_CONFIG.mix
            ][]
          ).map(([type, config]) => {
            const Icon = config.icon
            return (
              <button
                key={type}
                type='button'
                onClick={() => handleSelectType(type)}
                className='p-6 text-left transition-all border rounded-sm group bg-gb-darker-bg border-gb-pastel-green-2/20 hover:border-gb-highlight/50 hover:shadow-lg hover:-translate-y-1'>
                <div
                  className={`flex items-center justify-center w-12 h-12 mb-4 rounded-sm bg-${config.color}/20 group-hover:bg-${config.color}/30 transition-colors`}>
                  <Icon className={`w-6 h-6 text-${config.color}`} />
                </div>
                <h3 className='mb-2 text-lg font-bold text-gb-pastel-green-1'>
                  {config.title}
                </h3>
                <p className='mb-4 text-sm text-muted-foreground'>
                  {config.description}
                </p>
                <ul className='space-y-1'>
                  {config.features.map((feature) => (
                    <li
                      key={feature}
                      className='flex items-center gap-2 text-xs text-gb-default-text'>
                      <CheckCircle className='w-3 h-3 text-gb-pastel-green-2' />
                      {feature}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        <div className='p-6 mt-8 border rounded-sm bg-gb-darker-bg border-gb-highlight/30'>
          <div className='flex items-start gap-4'>
            <div className='flex items-center justify-center flex-shrink-0 w-12 h-12 rounded-sm bg-gb-highlight/20'>
              <List className='w-6 h-6 text-gb-highlight' />
            </div>
            <div className='flex-1'>
              <h3 className='mb-1 text-lg font-bold text-gb-highlight'>
                Uploading a DJ Mix?
              </h3>
              <p className='mb-3 text-sm text-gb-default-text'>
                Use our dedicated mix uploader to automatically mark tracklist
                timestamps as you play through your set.
              </p>
              <Link to='/mix-upload'>
                <Button className='bg-gb-highlight hover:bg-gb-pastel-green-1 text-gb-darker-bg'>
                  Go to Mix Uploader
                  <ArrowRight className='w-4 h-4 ml-2' />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8'>
      <div className='mb-8'>
        <div className='flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start'>
          <div>
            <div className='flex items-center gap-3 mb-2'>
              {!isEditMode && (
                <button
                  type='button'
                  onClick={() => setSelectedType(null)}
                  className='text-sm transition-colors text-muted-foreground hover:text-gb-pastel-green-1'>
                  ← Change type
                </button>
              )}
              <Badge
                variant='outline'
                className='border-gb-pastel-green-2/50 text-gb-pastel-green-1'>
                {getTypeLabel(formData.type)}
              </Badge>
            </div>
            <h1 className='text-3xl font-bold text-gb-highlight'>
              {isEditMode
                ? 'Edit Audio'
                : `Upload ${getTypeLabel(formData.type)}`}
            </h1>
            <p className='pl-0 mt-1 text-gb-default-text'>
              {isEditMode
                ? 'Update your audio content'
                : `Share your ${getTypeLabel(formData.type).toLowerCase()} with the world`}
            </p>
          </div>
          <div className='flex items-center space-x-4'>
            <Button
              variant='outline'
              onClick={() => handleSubmit(true)}
              disabled={
                isUploading ||
                (!isEditMode && !audioFile) ||
                uploadStep === 'success'
              }
              className='border-gb-pastel-green-2/30 text-gb-pastel-green-1 hover:bg-gb-pastel-green-2/20'>
              {isUploading ? (
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
              ) : uploadStep === 'success' ? (
                <CheckCircle className='w-4 h-4 mr-2' />
              ) : (
                <Save className='w-4 h-4 mr-2' />
              )}
              {uploadStep === 'success' ? 'Saved!' : 'Save Draft'}
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={isUploading || uploadStep === 'success'}
              className='bg-gb-pastel-green-2 hover:bg-gb-highlight text-gb-darker-bg'>
              {isUploading ? (
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
              ) : uploadStep === 'success' ? (
                <CheckCircle className='w-4 h-4 mr-2' />
              ) : (
                <Music className='w-4 h-4 mr-2' />
              )}
              {uploadStep === 'success'
                ? 'Published!'
                : isUploading
                  ? getUploadStepText()
                  : 'Publish'}
            </Button>
          </div>
        </div>
      </div>

      {formData.type === 'mix' && !isEditMode && (
        <div className='p-4 mb-6 border rounded-sm bg-gb-highlight/10 border-gb-highlight/30'>
          <div className='flex items-center gap-3'>
            <List className='w-5 h-5 text-gb-highlight' />
            <p className='text-sm text-gb-default-text'>
              <span className='font-medium text-gb-highlight'>Tip:</span> Want
              to mark tracklist timestamps as you listen?{' '}
              <Link
                to='/mix-upload'
                className='font-medium underline text-gb-highlight hover:text-gb-pastel-green-1'>
                Use the dedicated mix uploader
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className='grid gap-8 lg:grid-cols-12'>
        <div className='lg:col-span-8'>
          <Card className='h-full bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardContent className=''>
              <SimpleMarkdownEditor
                value={formData.content}
                onChange={(value) => handleInputChange('content', value)}
                placeholder={getPlaceholderContent(formData.type)}
              />
            </CardContent>
          </Card>
        </div>

        <div className='space-y-6 lg:col-span-4'>
          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardHeader>
              <CardTitle className='flex items-center text-gb-pastel-green-1'>
                <Music className='w-5 h-5 mr-2' />
                Audio File
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!audioFile ? (
                <div className='p-6 text-center transition-colors border-2 border-dashed rounded-sm border-gb-pastel-green-2/30 hover:border-gb-highlight/50'>
                  <Music className='w-8 h-8 mx-auto mb-3 text-gb-pastel-green-2' />
                  <p className='mb-3 text-sm text-gb-default-text'>
                    Drag and drop your audio file here
                  </p>
                  <input
                    type='file'
                    accept='audio/*'
                    onChange={handleAudioFileChange}
                    className='hidden'
                    id={audioUploadId}
                  />
                  <label htmlFor={audioUploadId}>
                    <Button
                      variant='outline'
                      size='sm'
                      className='bg-transparent cursor-pointer border-gb-pastel-green-2/30 text-gb-pastel-green-1 hover:bg-gb-pastel-green-2/20'
                      asChild>
                      <span>
                        <Upload className='w-4 h-4 mr-2' />
                        Choose File
                      </span>
                    </Button>
                  </label>
                  <p className='mt-2 text-xs text-gb-default-text/70'>
                    MP3, WAV, FLAC, M4A (Max 500MB)
                  </p>
                </div>
              ) : (
                <div className='space-y-3'>
                  <div className='flex items-center justify-between p-3 rounded-sm bg-gb-bg'>
                    <div className='flex items-center min-w-0 space-x-3'>
                      <Music className='flex-shrink-0 w-6 h-6 text-gb-highlight' />
                      <div className='min-w-0'>
                        <p className='font-medium leading-tight text-gb-pastel-green-1'>
                          {audioFile.name}
                        </p>
                        <p className='text-xs text-gb-default-text'>
                          {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
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
                  {audioPreview && (
                    /* biome-ignore lint/a11y/useMediaCaption: Audio preview for upload validation, captions not applicable */
                    <audio controls className='w-full'>
                      <source src={audioPreview} />
                      Your browser does not support the audio element.
                    </audio>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardHeader>
              <CardTitle className='text-gb-pastel-green-1'>Details</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor={titleId} className='text-gb-pastel-green-1'>
                  Title *
                </Label>
                <Input
                  id={titleId}
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder='Enter audio title...'
                  className='bg-gb-bg border-gb-pastel-green-2/30 text-gb-default-text focus:border-gb-highlight'
                />
              </div>

              <div className='space-y-2'>
                <Label
                  htmlFor={descriptionId}
                  className='text-gb-pastel-green-1'>
                  Description
                </Label>
                <Textarea
                  id={descriptionId}
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange('description', e.target.value)
                  }
                  placeholder={`Brief description of your ${getTypeLabel(formData.type).toLowerCase()}...`}
                  className='bg-gb-bg border-gb-pastel-green-2/30 text-gb-default-text focus:border-gb-highlight'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor={slugId} className='text-gb-pastel-green-1'>
                  URL Slug
                </Label>
                <Input
                  id={slugId}
                  value={formData.slug}
                  onChange={(e) => handleInputChange('slug', e.target.value)}
                  placeholder='url-friendly-slug (auto-generated if empty)'
                  className='bg-gb-bg border-gb-pastel-green-2/30 text-gb-default-text focus:border-gb-highlight'
                />
                {formData.title && !formData.slug && (
                  <p className='text-xs text-gb-default-text/70'>
                    Will be auto-generated as: {generateSlug(formData.title)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardHeader>
              <CardTitle className='flex items-center text-gb-pastel-green-1'>
                <ImageIcon className='w-5 h-5 mr-2' />
                Artwork
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!artworkFile && !artworkPreview ? (
                <div className='p-4 text-center transition-colors border-2 border-dashed rounded-sm border-gb-pastel-green-2/30 hover:border-gb-highlight/50'>
                  <ImageIcon className='w-6 h-6 mx-auto mb-2 text-gb-pastel-green-2' />
                  <p className='mb-2 text-xs text-gb-default-text'>
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
                  <p className='mt-1 text-xs text-gb-default-text/70'>
                    JPG, PNG, WebP (Max 10MB)
                  </p>
                </div>
              ) : (
                <div className='space-y-3'>
                  <div className='relative overflow-hidden border rounded-sm aspect-square bg-gb-bg border-gb-pastel-green-2/20'>
                    <img
                      src={artworkPreview || DEFAULT_IMAGE_URL}
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
                  {artworkFile && (
                    <p className='text-xs text-center text-gb-default-text'>
                      {artworkFile.name} (
                      {(artworkFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardHeader>
              <CardTitle className='text-gb-pastel-green-1'>Tags</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex gap-2'>
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder='Add a tag...'
                  className='bg-gb-bg border-gb-pastel-green-2/30 text-gb-default-text focus:border-gb-highlight'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                />
                <Button
                  onClick={addTag}
                  variant='outline'
                  className='bg-transparent border-gb-pastel-green-2/30 text-gb-pastel-green-1 hover:bg-gb-pastel-green-2/20'>
                  Add
                </Button>
              </div>

              <div className='flex flex-wrap gap-2'>
                {formData.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant='secondary'
                    className='flex items-center gap-1 bg-gb-pastel-green-2/20 text-gb-pastel-green-1'>
                    {tag}
                    <X
                      className='w-3 h-3 cursor-pointer hover:text-gb-highlight'
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
              </div>

              {formData.tags.length === 0 && (
                <p className='text-xs text-gb-default-text/70'>
                  Add tags to help people discover your{' '}
                  {getTypeLabel(formData.type).toLowerCase()}
                </p>
              )}
            </CardContent>
          </Card>

          {(isUploading || uploadStep === 'success') && (
            <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
              <CardHeader>
                <CardTitle
                  className={`flex items-center ${uploadStep === 'success' ? 'text-green-400' : 'text-gb-pastel-green-1'}`}>
                  {uploadStep === 'success' ? (
                    <>
                      <CheckCircle className='w-5 h-5 mr-2' />
                      Upload Complete!
                    </>
                  ) : (
                    <>
                      <Loader2 className='w-5 h-5 mr-2 animate-spin' />
                      {getUploadStepText()}
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  <div className='w-full h-2 rounded-sm bg-gb-bg'>
                    <div
                      className={`h-2 rounded-sm transition-all duration-500 ${
                        uploadStep === 'success'
                          ? 'bg-green-400'
                          : 'bg-gb-highlight animate-pulse'
                      }`}
                      style={{
                        width:
                          uploadStep === 'success'
                            ? '100%'
                            : uploadStep === 'creating-record'
                              ? '80%'
                              : uploadStep === 'uploading-image'
                                ? '60%'
                                : uploadStep === 'uploading-audio'
                                  ? '30%'
                                  : '10%'
                      }}
                    />
                  </div>
                  <p className='text-sm text-gb-default-text'>
                    {uploadStep === 'success'
                      ? `"${formData.title}" has been uploaded successfully! Redirecting...`
                      : getUploadStepText()}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
