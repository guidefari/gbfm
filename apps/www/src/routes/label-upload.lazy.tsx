'use client'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  toast
} from '@gbfm/ui'
import { useMutation } from '@tanstack/react-query'
import { createLazyFileRoute, useRouter } from '@tanstack/react-router'
import { ImageIcon, Loader2, Upload, X } from 'lucide-react'
import { useId, useState } from 'react'
import { SimpleMarkdownEditor } from '@/components/simple-markdown-editor'
import { fetcher, VPS_BASE_URL } from '@/lib/http'
import { useSession } from '@/lib/auth-client'

export const Route = createLazyFileRoute('/label-upload')({
  component: LabelUploadPage
})

interface LabelFormData {
  title: string
  description: string
  slug: string
  content: string
  thumbnailUrl: string
  website: string
  bandcamp: string
  discogs: string
}

function LabelUploadPage() {
  const search = Route.useSearch() as {
    edit?: string
    title?: string
    description?: string
    content?: string
    thumbnailUrl?: string
    website?: string
    bandcamp?: string
    discogs?: string
  }
  const isEditMode = Boolean(search.edit)

  const [formData, setFormData] = useState<LabelFormData>(() => ({
    title: search.title || '',
    description: search.description || '',
    slug: search.edit || '', // Use the edit slug as the base slug
    content: search.content || '',
    thumbnailUrl: search.thumbnailUrl || '',
    website: search.website || '',
    bandcamp: search.bandcamp || '',
    discogs: search.discogs || ''
  }))
  const [uploadStep, setUploadStep] = useState<
    'idle' | 'uploading-image' | 'creating-record' | 'success'
  >('idle')
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null)

  const { data: session } = useSession()
  const user = session?.user
  const router = useRouter()

  const artworkUploadId = useId()

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const uploadMutation = useMutation({
    mutationFn: async (data: LabelFormData & { artworkFile: File | null }) => {
      if (!user) {
        toast({
          title: 'Please login/signup to upload content',
          variant: 'destructive'
        })
        return
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

      const labelData = {
        name: data.title,
        slug: data.slug || generateSlug(data.title),
        description: data.description,
        content: data.content,
        thumbnailUrl: imageUrl,
        website: data.website,
        bandcamp: data.bandcamp,
        discogs: data.discogs
      }

      const endpoint = isEditMode
        ? `${VPS_BASE_URL}/content/labels/${search.edit}`
        : `${VPS_BASE_URL}/content/labels`

      const method = isEditMode ? 'PATCH' : 'POST'

      const result = await fetcher(endpoint, {
        method,
        body: JSON.stringify(labelData)
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
        setUploadStep('idle')
        router.navigate({
          to: isEditMode ? `/labels/${search.edit}` : '/labels'
        })
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

  const handleInputChange = (field: keyof LabelFormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }
      if (field === 'title' && !prev.slug) {
        updated.slug = generateSlug(value)
      }
      return updated
    })
  }

  const handleArtworkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setArtworkFile(file)
      const url = URL.createObjectURL(file)
      setArtworkPreview(url)
    }
  }

  const removeArtworkFile = () => {
    setArtworkFile(null)
    if (artworkPreview) {
      URL.revokeObjectURL(artworkPreview)
      setArtworkPreview(null)
    }
  }

  const handleSubmit = async () => {
    const submitData = { ...formData, artworkFile }
    uploadMutation.mutate(submitData)
  }

  const handleDiscard = () => {
    setFormData({
      title: '',
      description: '',
      slug: '',
      content: '',
      thumbnailUrl: '',
      website: '',
      bandcamp: '',
      discogs: ''
    })
    setArtworkFile(null)
    if (artworkPreview) URL.revokeObjectURL(artworkPreview)
    setArtworkPreview(null)
    setUploadStep('idle')
  }

  const isUploading = uploadStep !== 'idle' && uploadStep !== 'success'

  return (
    <div className='px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8'>
      <header className='mb-8'>
        <div className='flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start'>
          <div>
            <h1 className='text-3xl font-bold text-gb-highlight'>
              {isEditMode ? 'Edit Record Label' : 'Upload Record Label'}
            </h1>
            <p className='pl-0 mt-1 text-gb-default-text'>
              {isEditMode
                ? 'Update your record label information.'
                : 'Add a new record label to the catalog.'}
            </p>
          </div>
          {isUploading && (
            <div className='w-full p-4 border rounded-sm md:w-64 bg-gb-darker-bg border-gb-pastel-green-2/20'>
              <div className='flex justify-between mb-2 text-sm'>
                <span className='font-medium text-gb-pastel-green-1'>
                  Uploading Label...
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
                          ? '50%'
                          : '20%'
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      <div className='grid grid-cols-1 gap-8 lg:grid-cols-12'>
        <div className='space-y-6 lg:col-span-8'>
          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardContent className='pt-6 space-y-6'>
              <div className='space-y-2'>
                <Label className='text-gb-pastel-green-1'>Label Name</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder='Label Name'
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
                  placeholder='Brief description of the label...'
                  className='bg-gb-bg border-gb-pastel-green-2/30'
                />
              </div>

              <div className='space-y-2'>
                <Label className='text-gb-pastel-green-1'>URL Slug</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) => handleInputChange('slug', e.target.value)}
                  placeholder='url-friendly-slug'
                  className='bg-gb-bg border-gb-pastel-green-2/30'
                />
                {formData.title && !formData.slug && (
                  <p className='text-xs text-muted-foreground'>
                    Will be: {generateSlug(formData.title)}
                  </p>
                )}
              </div>

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
                <div className='space-y-2'>
                  <Label className='text-gb-pastel-green-1'>Website</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) =>
                      handleInputChange('website', e.target.value)
                    }
                    placeholder='https://...'
                    className='bg-gb-bg border-gb-pastel-green-2/30'
                  />
                </div>

                <div className='space-y-2'>
                  <Label className='text-gb-pastel-green-1'>Bandcamp</Label>
                  <Input
                    value={formData.bandcamp}
                    onChange={(e) =>
                      handleInputChange('bandcamp', e.target.value)
                    }
                    placeholder='https://...'
                    className='bg-gb-bg border-gb-pastel-green-2/30'
                  />
                </div>

                <div className='space-y-2'>
                  <Label className='text-gb-pastel-green-1'>Discogs</Label>
                  <Input
                    value={formData.discogs}
                    onChange={(e) =>
                      handleInputChange('discogs', e.target.value)
                    }
                    placeholder='https://...'
                    className='bg-gb-bg border-gb-pastel-green-2/30'
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label className='text-gb-pastel-green-1'>Artwork</Label>
                {!artworkFile && !artworkPreview ? (
                  <div className='p-4 text-center transition-colors border-2 border-dashed rounded-sm border-gb-pastel-green-2/30 hover:border-gb-highlight/50'>
                    <ImageIcon className='w-6 h-6 mx-auto mb-2 text-gb-pastel-green-2' />
                    <p className='mb-2 text-xs text-muted-foreground'>
                      Upload label artwork
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
                        src={artworkPreview || formData.thumbnailUrl || ''}
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

          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardContent className='pt-6'>
              <SimpleMarkdownEditor
                value={formData.content}
                onChange={(value) => handleInputChange('content', value)}
                placeholder={`# About ${formData.title || 'This Label'}

Tell the story of this record label. What makes it special? What artists do they work with?`}
              />
            </CardContent>
          </Card>
        </div>

        <div className='lg:col-span-4'>
          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardHeader>
              <CardTitle className='text-gb-pastel-green-1'>
                Label Summary
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <h3 className='font-medium text-gb-pastel-green-1 mb-2'>
                  Name
                </h3>
                <p className='text-sm text-muted-foreground'>
                  {formData.title || 'Not set'}
                </p>
              </div>

              <div>
                <h3 className='font-medium text-gb-pastel-green-1 mb-2'>
                  Description
                </h3>
                <p className='text-sm text-muted-foreground'>
                  {formData.description || 'Not set'}
                </p>
              </div>

              {formData.website && (
                <div>
                  <h3 className='font-medium text-gb-pastel-green-1 mb-2'>
                    Links
                  </h3>
                  <div className='space-y-1'>
                    {formData.website && (
                      <a
                        href={formData.website}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='block text-sm text-gb-highlight hover:underline'>
                        Website
                      </a>
                    )}
                    {formData.bandcamp && (
                      <a
                        href={formData.bandcamp}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='block text-sm text-gb-highlight hover:underline'>
                        Bandcamp
                      </a>
                    )}
                    {formData.discogs && (
                      <a
                        href={formData.discogs}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='block text-sm text-gb-highlight hover:underline'>
                        Discogs
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className='flex gap-2 pt-4'>
                <Button
                  onClick={handleSubmit}
                  disabled={isUploading || !formData.title.trim()}
                  className='flex-1'>
                  {isUploading
                    ? 'Uploading...'
                    : isEditMode
                      ? 'Update Label'
                      : 'Upload Label'}
                </Button>
                <Button
                  variant='outline'
                  onClick={handleDiscard}
                  disabled={isUploading}>
                  Discard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
