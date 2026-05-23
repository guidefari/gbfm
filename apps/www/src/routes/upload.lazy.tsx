'use client'

import { Badge, Button, Card, CardContent, toast } from '@gbfm/ui'
import { useMutation } from '@tanstack/react-query'
import { createLazyFileRoute, Link, useRouter } from '@tanstack/react-router'
import { CheckCircle, List, Loader2, Music, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SimpleMarkdownEditor } from '@/components/simple-markdown-editor'
import {
  ArtworkUploader,
  AudioDetailsForm,
  AudioUploader,
  type ContentType,
  ContentTypeSelector,
  getTypeLabel,
  TagsInput,
  UploadProgress,
  type UploadStep
} from '@/components/upload'
import { generateSlug, useFileUpload } from '@/hooks/useFileUpload'
import { useSession } from '@/lib/auth-client'
import { fetcher, useAudioBySlug, VPS_BASE_URL } from '@/lib/http'

export const Route = createLazyFileRoute('/upload')({
  component: UploadPage
})

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

function getPlaceholderContent(type: string, title: string) {
  switch (type) {
    case 'mix':
      return `# ${title || 'Your Mix Title'}

## About This Mix
Describe the vibe, inspiration, and journey of your mix...

## Tracklist
1. Artist - Track Name (00:00)
2. Artist - Track Name (05:30)
3. Artist - Track Name (10:15)

## Mix Notes
Add any technical details, equipment used, or special techniques...`
    case 'track':
      return `# ${title || 'Your Track Title'}

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
      return `# ${title || 'Your Audio Title'}

## Description
Tell us about this audio piece...

## Details
Add any relevant information, credits, or notes...`
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
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle')

  const audioUpload = useFileUpload({
    onTitleInfer: (title) => handleInputChange('title', title)
  })
  const artworkUpload = useFileUpload()

  const { data: session } = useSession()
  const user = session?.user
  const router = useRouter()

  useEffect(() => {
    if (isEditMode && editQuery.data && !editQuery.isPending) {
      const data = editQuery.data
      const audioType: ContentType = (data.type as ContentType) ?? 'mix'
      setFormData({
        title: data.title,
        description: data.description || '',
        slug: data.slug,
        type: audioType,
        content: data.content,
        thumbnailUrl: data.thumbnailUrl || '',
        tags: data.tags || [],
        draft: data.draft
      })
      setSelectedType(audioType)
    }
  }, [isEditMode, editQuery.data, editQuery.isPending])

  const uploadMutation = useMutation({
    mutationFn: async (data: AudioFormData & { isDraft: boolean }) => {
      if (!user) {
        toast({
          title: 'Please login/signup to upload content',
          variant: 'destructive'
        })
        return
      }

      setUploadStep('uploading-audio')

      let audioUrl = ''
      if (audioUpload.file) {
        const uploadFormData = new FormData()
        uploadFormData.append('audioFile', audioUpload.file)
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
      if (artworkUpload.file) {
        const imageFormData = new FormData()
        imageFormData.append('imageFile', artworkUpload.file)
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
        audioUpload.removeFile()
        artworkUpload.removeFile()
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

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    audioUpload.handleFileChange(e, !formData.title)
  }

  const handleSubmit = async (isDraft: boolean) => {
    if (!isEditMode && !audioUpload.file) {
      toast({
        title: 'Audio file required',
        description: 'Please select an audio file to upload.',
        variant: 'destructive'
      })
      return
    }

    uploadMutation.mutate({ ...formData, isDraft })
  }

  const handleSelectType = (type: ContentType) => {
    setSelectedType(type)
    setFormData((prev) => ({ ...prev, type }))
  }

  const handleAddTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: [...prev.tags, tag]
    }))
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove)
    }))
  }

  const isUploading = uploadStep !== 'idle' && uploadStep !== 'success'
  const typeLabel = getTypeLabel(formData.type)

  if (!selectedType && !isEditMode) {
    return <ContentTypeSelector onSelect={handleSelectType} />
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
                {typeLabel}
              </Badge>
            </div>
            <h1 className='text-3xl font-bold text-gb-highlight'>
              {isEditMode ? 'Edit Audio' : `Upload ${typeLabel}`}
            </h1>
            <p className='pl-0 mt-1 text-gb-default-text'>
              {isEditMode
                ? 'Update your audio content'
                : `Share your ${typeLabel.toLowerCase()} with the world`}
            </p>
          </div>
          <div className='flex items-center space-x-4'>
            <Button
              variant='outline'
              onClick={() => handleSubmit(true)}
              disabled={
                isUploading ||
                (!isEditMode && !audioUpload.file) ||
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
              {uploadStep === 'success' ? 'Published!' : 'Publish'}
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
                placeholder={getPlaceholderContent(
                  formData.type,
                  formData.title
                )}
              />
            </CardContent>
          </Card>
        </div>

        <div className='space-y-6 lg:col-span-4'>
          <AudioUploader
            audioFile={audioUpload.file}
            audioPreview={audioUpload.preview}
            onFileChange={handleAudioFileChange}
            onRemove={() => audioUpload.removeFile()}
          />

          <AudioDetailsForm
            title={formData.title}
            description={formData.description}
            slug={formData.slug}
            contentTypeLabel={typeLabel}
            onTitleChange={(value) => handleInputChange('title', value)}
            onDescriptionChange={(value) =>
              handleInputChange('description', value)
            }
            onSlugChange={(value) => handleInputChange('slug', value)}
          />

          <ArtworkUploader
            artworkFile={artworkUpload.file}
            artworkPreview={artworkUpload.preview}
            onFileChange={(e) => artworkUpload.handleFileChange(e)}
            onRemove={() => artworkUpload.removeFile()}
          />

          <TagsInput
            tags={formData.tags}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            contentTypeLabel={typeLabel.toLowerCase()}
          />

          {(isUploading || uploadStep === 'success') && (
            <UploadProgress step={uploadStep} title={formData.title} />
          )}
        </div>
      </div>
    </div>
  )
}
