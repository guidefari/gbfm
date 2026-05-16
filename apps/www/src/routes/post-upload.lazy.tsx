'use client'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast
} from '@gbfm/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createLazyFileRoute, useRouter } from '@tanstack/react-router'
import { ImageIcon, Loader2, Save, Upload, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { SimpleMarkdownEditor } from '@/components/simple-markdown-editor'
import { TagsInput } from '@/components/upload'
import { fetcher, VPS_BASE_URL } from '@/lib/http'
import { useAuthStore } from '@/store'
import { UserSearch } from './admin/_components/-UserSearch'

export const Route = createLazyFileRoute('/post-upload')({
  component: PostUploadPage
})

type PostType = 'post' | 'micro'

interface PostItem {
  id: string
  title: string
  description: string | null
  slug: string
  content: string
  thumbnailUrl: string | null
  tags: string[] | null
  draft: boolean
  type: PostType | null
  creators?: Array<{ id: string; name: string }>
}

interface PostFormData {
  title: string
  description: string
  slug: string
  content: string
  thumbnailUrl: string
  tags: string[]
  draft: boolean
  type: PostType
}

function PostUploadPage() {
  const search = Route.useSearch() as {
    edit?: string
    type?: PostType
  }
  const isEditMode = Boolean(search.edit)
  const router = useRouter()
  const { user } = useAuthStore()
  const artworkUploadId = useId()

  const [formData, setFormData] = useState<PostFormData>({
    title: '',
    description: '',
    slug: '',
    content: '',
    thumbnailUrl: '',
    tags: [],
    draft: false,
    type: search.type ?? 'post'
  })
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null)
  const [uploadStep, setUploadStep] = useState<
    'idle' | 'uploading-image' | 'saving' | 'success'
  >('idle')
  const [selectedCreators, setSelectedCreators] = useState<
    Array<{ id: string; name: string }>
  >([])

  const { data: existingPost, isPending: loadingPost } = useQuery({
    queryKey: ['post', search.edit],
    queryFn: () =>
      fetcher<PostItem>(`${VPS_BASE_URL}/content/posts/${search.edit}`),
    enabled: isEditMode && Boolean(search.edit)
  })

  useEffect(() => {
    if (!existingPost) return
    setFormData({
      title: existingPost.title || '',
      description: existingPost.description || '',
      slug: existingPost.slug || '',
      content: existingPost.content || '',
      thumbnailUrl: existingPost.thumbnailUrl || '',
      tags: existingPost.tags || [],
      draft: existingPost.draft ?? false,
      type: existingPost.type || search.type || 'post'
    })
    setSelectedCreators(existingPost.creators || [])
  }, [existingPost, search.type])

  useEffect(() => {
    if (isEditMode || !user) return
    setSelectedCreators([{ id: user.id, name: user.name || 'You' }])
  }, [isEditMode, user])

  const heading = useMemo(
    () => (formData.type === 'micro' ? 'Tweet' : 'Editorial'),
    [formData.type]
  )

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const saveMutation = useMutation({
    mutationFn: async (data: PostFormData) => {
      if (!user) {
        throw new Error('Please sign in to edit content')
      }

      setUploadStep('uploading-image')

      let imageUrl = data.thumbnailUrl
      if (artworkFile) {
        const imageFormData = new FormData()
        imageFormData.append('imageFile', artworkFile)
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

      setUploadStep('saving')

      const payload = {
        title: data.title,
        description: data.description,
        slug: data.slug || generateSlug(data.title),
        content: data.content,
        thumbnailUrl: imageUrl || null,
        tags: data.tags,
        draft: data.draft,
        type: data.type,
        creatorIds:
          selectedCreators.length > 0
            ? selectedCreators.map((creator) => creator.id)
            : [user.id]
      }

      const endpoint = isEditMode
        ? `${VPS_BASE_URL}/content/posts/${search.edit}`
        : `${VPS_BASE_URL}/content/post`

      const method = isEditMode ? 'PATCH' : 'POST'

      return fetcher<PostItem>(endpoint, {
        method,
        body: JSON.stringify(payload)
      })
    },
    onSuccess: (savedPost) => {
      setUploadStep('success')
      toast({
        title: isEditMode ? 'Post updated' : 'Post created',
        description: `"${savedPost.title}" saved successfully.`
      })

      const savedType = savedPost.type || formData.type
      const targetPath =
        savedType === 'micro'
          ? `/tweet/${savedPost.slug}`
          : `/editorial/${savedPost.slug}`

      setTimeout(() => {
        router.navigate({ to: targetPath })
      }, 500)
    },
    onError: (error) => {
      toast({
        title: 'Failed to save post',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.',
        variant: 'destructive'
      })
      setUploadStep('idle')
    }
  })

  const handleArtworkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setArtworkFile(file)
      const preview = URL.createObjectURL(file)
      setArtworkPreview(preview)
    }
  }

  const removeArtworkFile = () => {
    setArtworkFile(null)
    if (artworkPreview) {
      URL.revokeObjectURL(artworkPreview)
      setArtworkPreview(null)
    }
    setFormData((prev) => ({ ...prev, thumbnailUrl: '' }))
  }

  const handleInputChange = (
    field: keyof PostFormData,
    value: string | boolean
  ) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }
      if (field === 'title' && !prev.slug && typeof value === 'string') {
        updated.slug = generateSlug(value)
      }
      return updated
    })
  }

  const handleDiscard = () => {
    if (existingPost) {
      setFormData({
        title: existingPost.title || '',
        description: existingPost.description || '',
        slug: existingPost.slug || '',
        content: existingPost.content || '',
        thumbnailUrl: existingPost.thumbnailUrl || '',
        tags: existingPost.tags || [],
        draft: existingPost.draft ?? false,
        type: existingPost.type || 'post'
      })
      return
    }

    setFormData({
      title: '',
      description: '',
      slug: '',
      content: '',
      thumbnailUrl: '',
      tags: [],
      draft: false,
      type: search.type || 'post'
    })
    removeArtworkFile()
  }

  if (isEditMode && loadingPost) {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className='w-6 h-6 mr-2 animate-spin' />
        Loading post...
      </div>
    )
  }

  return (
    <div className='px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8'>
      <header className='mb-8'>
        <div className='flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start'>
          <div>
            <h1 className='text-3xl font-bold text-gb-highlight'>
              {isEditMode ? `Edit ${heading}` : `Create ${heading}`}
            </h1>
            <p className='mt-1 text-gb-default-text'>
              {heading === 'Tweet'
                ? 'Write and publish short-form micro posts.'
                : 'Write and publish long-form editorial posts.'}
            </p>
          </div>
          <div className='flex gap-3'>
            <Button
              variant='outline'
              onClick={handleDiscard}
              disabled={saveMutation.isPending}>
              Discard
            </Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={
                saveMutation.isPending || !formData.title || !formData.content
              }>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                  {uploadStep === 'uploading-image'
                    ? 'Uploading...'
                    : 'Saving...'}
                </>
              ) : (
                <>
                  <Save className='w-4 h-4 mr-2' />
                  {isEditMode ? 'Update' : 'Publish'}
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className='grid gap-8 xl:grid-cols-[1fr_320px]'>
        <div className='space-y-6'>
          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardHeader>
              <CardTitle className='text-gb-pastel-green-1'>Details</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label className='text-gb-pastel-green-1'>Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder='Post title'
                  />
                </div>
                <div className='space-y-2'>
                  <Label className='text-gb-pastel-green-1'>Slug</Label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => handleInputChange('slug', e.target.value)}
                    placeholder='url-friendly-slug'
                  />
                </div>
              </div>
              <div className='space-y-2'>
                <Label className='text-gb-pastel-green-1'>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange('description', e.target.value)
                  }
                  placeholder='Short description'
                />
              </div>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label className='text-gb-pastel-green-1'>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      handleInputChange('type', value as PostType)
                    }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='post'>Editorial</SelectItem>
                      <SelectItem value='micro'>Tweet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className='flex items-center justify-between rounded-sm border p-3'>
                <div>
                  <p className='font-medium'>Draft</p>
                  <p className='text-xs text-muted-foreground'>
                    Keep unpublished while editing.
                  </p>
                </div>
                <Checkbox
                  checked={formData.draft}
                  onCheckedChange={(checked) =>
                    handleInputChange('draft', checked === true)
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardHeader>
              <CardTitle className='text-gb-pastel-green-1'>Content</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleMarkdownEditor
                value={formData.content}
                onChange={(value) => handleInputChange('content', value)}
                placeholder='Write your post content in markdown...'
              />
            </CardContent>
          </Card>
        </div>

        <div className='space-y-6'>
          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardHeader>
              <CardTitle className='text-gb-pastel-green-1'>Artwork</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {!artworkFile && !formData.thumbnailUrl ? (
                <label
                  htmlFor={artworkUploadId}
                  className='flex flex-col gap-3 justify-center items-center p-8 text-center rounded-sm border-2 border-dashed cursor-pointer transition-colors border-gb-pastel-green-2/40 hover:border-gb-highlight'>
                  <ImageIcon className='w-8 h-8 text-gb-pastel-green-1' />
                  <div>
                    <p className='font-medium text-gb-pastel-green-1'>
                      Upload artwork
                    </p>
                    <p className='text-xs text-gb-default-text'>
                      PNG, JPG, WEBP up to 10MB
                    </p>
                  </div>
                  <Upload className='w-4 h-4' />
                </label>
              ) : (
                <div className='relative p-3 rounded-sm border'>
                  <img
                    src={artworkPreview || formData.thumbnailUrl}
                    alt='Post artwork'
                    className='object-cover w-full h-40 rounded-sm'
                  />
                  <Button
                    type='button'
                    size='icon'
                    variant='destructive'
                    className='absolute top-5 right-5 w-7 h-7'
                    onClick={removeArtworkFile}>
                    <X className='w-4 h-4' />
                  </Button>
                </div>
              )}
              <Input
                id={artworkUploadId}
                type='file'
                accept='image/*'
                onChange={handleArtworkFileChange}
                className='hidden'
              />
              <div className='space-y-2'>
                <Label className='text-gb-pastel-green-1'>Or image URL</Label>
                <Input
                  value={formData.thumbnailUrl}
                  onChange={(e) =>
                    handleInputChange('thumbnailUrl', e.target.value)
                  }
                  placeholder='https://...'
                />
              </div>
            </CardContent>
          </Card>

          <TagsInput
            tags={formData.tags}
            onAddTag={(tag) =>
              setFormData((prev) => ({
                ...prev,
                tags: Array.from(new Set([...prev.tags, tag]))
              }))
            }
            onRemoveTag={(tag) =>
              setFormData((prev) => ({
                ...prev,
                tags: prev.tags.filter((existing) => existing !== tag)
              }))
            }
            contentTypeLabel={heading}
          />

          <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
            <CardHeader>
              <CardTitle className='text-gb-pastel-green-1'>Creator</CardTitle>
            </CardHeader>
            <CardContent>
              <UserSearch
                label='Post Creator'
                selectedUsers={selectedCreators}
                onSelectionChange={(users) =>
                  setSelectedCreators(
                    users.length > 1 ? [users[users.length - 1]] : users
                  )
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
