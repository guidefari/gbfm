'use client'

import type React from 'react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { SimpleMarkdownEditor } from '@/components/simple-markdown-editor'
import {
  Save,
  Upload,
  X,
  Music,
  ImageIcon,
  Trash2,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { createLazyFileRoute, useRouter } from '@tanstack/react-router'
import { fetcher, useAudioBySlug, VPS_BASE_URL } from '@/lib/http'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/store'
import { toast } from '@/components/ui/use-toast'

export const Route = createLazyFileRoute('/upload')({
  component: UploadPage
})

interface AudioFormData {
  title: string
  description: string
  slug: string
  type: 'mix' | 'track' | 'misc'
  content: string
  thumbnailUrl: string
  tags: string[]
  draft: boolean
}

function UploadPage() {
  const search = Route.useSearch()
  const isEditMode =
    (search.edit === 'true' || search.edit === true) &&
    search.archetype &&
    search.id

  // Load existing content if in edit mode
  const editQuery = useAudioBySlug(
    search.archetype as 'mix' | 'track' | 'misc',
    search.id || ''
  )

  const [formData, setFormData] = useState<AudioFormData>({
    title: '',
    description: '',
    slug: '',
    type: 'mix',
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

  // Populate form data when editing existing content
  useEffect(() => {
    if (isEditMode && editQuery.data && !editQuery.isPending) {
      const data = editQuery.data
      setFormData({
        title: data.title,
        description: data.description,
        slug: data.slug,
        type: data.type,
        content: data.content,
        thumbnailUrl: data.thumbnailUrl,
        tags: data.tags || [],
        draft: data.draft
      })
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

      // Create form data for file uploads
      const uploadFormData = new FormData()

      // Upload audio file if present
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

      // Upload image file if present
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

      // Create or update audio record
      const audioData = {
        title: data.title,
        description: data.description,
        slug: data.slug || generateSlug(data.title),
        content: data.content,
        thumbnailUrl: imageUrl,
        url: audioUrl || editQuery.data?.url, // Keep existing URL if no new audio file
        type: data.type,
        tags: data.tags,
        authorIds: [user?.id]
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

      // Reset form after a brief delay to show success state
      setTimeout(() => {
        // Reset all form data
        setFormData({
          title: '',
          description: '',
          slug: '',
          type: 'mix',
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

        // Navigate to tracks page or the created track
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
      const updated = {
        ...prev,
        [field]: value
      }

      // Auto-generate slug if it's empty and title is being updated
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

      // Auto-fill title if empty
      if (!formData.title) {
        const fileName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
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
    switch (type) {
      case 'mix':
        return 'DJ Mix'
      case 'track':
        return 'Track'
      case 'misc':
        return 'Other'
      default:
        return type
    }
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

  return (
    <div className='px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8'>
      {/* Header */}
      <div className='mb-8'>
        <div className='flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start'>
          <div>
            <h1 className='text-3xl font-bold text-gb-highlight'>
              {isEditMode ? 'Edit Audio' : 'Upload Audio'}
            </h1>
            <p className='pl-0 mt-1 text-gb-default-text'>
              {isEditMode
                ? 'Update your audio content'
                : 'Share your mixes, tracks, and audio creations'}
            </p>
          </div>
          <div className='flex items-center space-x-4'>
            <Button
              variant='outline'
              onClick={() => handleSubmit(true)}
              disabled={isUploading || !audioFile || uploadStep === 'success'}
              className='border-gb-pastel-green-2/30 text-gb-pastel-green-1 hover:bg-gb-pastel-green-2/20'>
              {isUploading ? (
                <Loader2 className='mr-2 w-4 h-4 animate-spin' />
              ) : uploadStep === 'success' ? (
                <CheckCircle className='mr-2 w-4 h-4' />
              ) : (
                <Save className='mr-2 w-4 h-4' />
              )}
              {uploadStep === 'success' ? 'Saved!' : 'Save Draft'}
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              // disabled={isUploading || !audioFile || uploadStep === 'success'}
              className='bg-gb-pastel-green-2 hover:bg-gb-highlight text-gb-darker-bg'>
              {isUploading ? (
                <Loader2 className='mr-2 w-4 h-4 animate-spin' />
              ) : uploadStep === 'success' ? (
                <CheckCircle className='mr-2 w-4 h-4' />
              ) : (
                <Music className='mr-2 w-4 h-4' />
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

      <div className='grid gap-8 lg:grid-cols-12'>
        {/* Main Content - Markdown Editor */}
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

        {/* Sidebar - All Metadata */}
        <div className='space-y-6 lg:col-span-4'>
          {/* Audio Upload */}
          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardHeader>
              <CardTitle className='flex items-center text-gb-pastel-green-1'>
                <Music className='mr-2 w-5 h-5' />
                Audio File
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!audioFile ? (
                <div className='p-6 text-center rounded-lg border-2 border-dashed transition-colors border-gb-pastel-green-2/30 hover:border-gb-highlight/50'>
                  <Music className='mx-auto mb-3 w-8 h-8 text-gb-pastel-green-2' />
                  <p className='mb-3 text-sm text-gb-default-text'>
                    Drag and drop your audio file here
                  </p>
                  <input
                    type='file'
                    accept='audio/*'
                    onChange={handleAudioFileChange}
                    className='hidden'
                    id='audio-upload'
                  />
                  <label htmlFor='audio-upload'>
                    <Button
                      variant='outline'
                      size='sm'
                      className='bg-transparent cursor-pointer border-gb-pastel-green-2/30 text-gb-pastel-green-1 hover:bg-gb-pastel-green-2/20'
                      asChild>
                      <span>
                        <Upload className='mr-2 w-4 h-4' />
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
                  <div className='flex justify-between items-center p-3 rounded-lg bg-gb-bg'>
                    <div className='flex items-center space-x-3 min-w-0'>
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
                    <audio controls className='w-full'>
                      <source src={audioPreview} />
                      Your browser does not support the audio element.
                    </audio>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Basic Details */}
          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardHeader>
              <CardTitle className='text-gb-pastel-green-1'>Details</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='title' className='text-gb-pastel-green-1'>
                  Title *
                </Label>
                <Input
                  id='title'
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder='Enter audio title...'
                  className='bg-gb-bg border-gb-pastel-green-2/30 text-gb-default-text focus:border-gb-highlight'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='type' className='text-gb-pastel-green-1'>
                  Type *
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: any) =>
                    handleInputChange('type', value)
                  }>
                  <SelectTrigger className='bg-gb-bg border-gb-pastel-green-2/30 text-gb-default-text'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
                    <SelectItem value='mix'>DJ Mix</SelectItem>
                    <SelectItem value='track'>Track</SelectItem>
                    <SelectItem value='misc'>Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='description' className='text-gb-pastel-green-1'>
                  Description
                </Label>
                <Textarea
                  id='description'
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange('description', e.target.value)
                  }
                  placeholder={`Brief description of your ${getTypeLabel(formData.type).toLowerCase()}...`}
                  className='bg-gb-bg border-gb-pastel-green-2/30 text-gb-default-text focus:border-gb-highlight'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='slug' className='text-gb-pastel-green-1'>
                  URL Slug
                </Label>
                <Input
                  id='slug'
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

          {/* Artwork Upload */}
          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardHeader>
              <CardTitle className='flex items-center text-gb-pastel-green-1'>
                <ImageIcon className='mr-2 w-5 h-5' />
                Artwork
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!artworkFile && !artworkPreview ? (
                <div className='p-4 text-center rounded-lg border-2 border-dashed transition-colors border-gb-pastel-green-2/30 hover:border-gb-highlight/50'>
                  <ImageIcon className='mx-auto mb-2 w-6 h-6 text-gb-pastel-green-2' />
                  <p className='mb-2 text-xs text-gb-default-text'>
                    Upload cover artwork
                  </p>
                  <input
                    type='file'
                    accept='image/*'
                    onChange={handleArtworkFileChange}
                    className='hidden'
                    id='artwork-upload'
                  />
                  <label htmlFor='artwork-upload'>
                    <Button
                      variant='outline'
                      size='sm'
                      className='bg-transparent cursor-pointer border-gb-pastel-green-2/30 text-gb-pastel-green-1 hover:bg-gb-pastel-green-2/20'
                      asChild>
                      <span>
                        <Upload className='mr-2 w-4 h-4' />
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
                  <div className='overflow-hidden relative rounded-lg border aspect-square bg-gb-bg border-gb-pastel-green-2/20'>
                    <img
                      src={artworkPreview || '/placeholder.svg'}
                      alt='Artwork preview'
                      className='object-cover w-full h-full'
                    />
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={removeArtworkFile}
                      className='absolute top-2 right-2 text-white bg-black/50 hover:bg-black/70'>
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

          {/* Tags */}
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
                  onKeyPress={(e) =>
                    e.key === 'Enter' && (e.preventDefault(), addTag())
                  }
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
                    className='flex gap-1 items-center bg-gb-pastel-green-2/20 text-gb-pastel-green-1'>
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

          {/* Upload Progress */}
          {(isUploading || uploadStep === 'success') && (
            <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
              <CardHeader>
                <CardTitle
                  className={`flex items-center ${uploadStep === 'success' ? 'text-green-400' : 'text-gb-pastel-green-1'}`}>
                  {uploadStep === 'success' ? (
                    <>
                      <CheckCircle className='mr-2 w-5 h-5' />
                      Upload Complete!
                    </>
                  ) : (
                    <>
                      <Loader2 className='mr-2 w-5 h-5 animate-spin' />
                      {getUploadStepText()}
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  <div className='w-full h-2 rounded-full bg-gb-bg'>
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
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
                      }}></div>
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
