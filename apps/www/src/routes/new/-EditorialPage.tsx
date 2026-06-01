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
  TagsInput,
  Textarea,
  toast
} from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useRouter, useSearch } from '@tanstack/react-router'
import { ArrowLeft, ImageIcon, Loader2, Save, Upload, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { PostPageHeader } from '@/components/PostPageHeader'
import { SimpleMarkdownEditor } from '@/components/simple-markdown-editor'
import { useSession } from '@/lib/auth-client'
import { fetcher, VPS_BASE_URL } from '@/lib/http'
import { readResponseErrorMessage, readUploadResponse } from '@/lib/response'
import { UserSearch } from '../admin/_components/-UserSearch'

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
}

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function toPostFormData(post: PostItem): PostFormData {
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

function EditorialDetailsCard({
  formData,
  onInputChange
}: {
  formData: PostFormData
  onInputChange: (field: keyof PostFormData, value: string | boolean) => void
}) {
  return (
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
              onChange={(e) => onInputChange('title', e.target.value)}
              placeholder='Post title'
            />
          </div>
          <div className='space-y-2'>
            <Label className='text-gb-pastel-green-1'>Slug</Label>
            <Input
              value={formData.slug}
              onChange={(e) => onInputChange('slug', e.target.value)}
              placeholder='url-friendly-slug'
            />
          </div>
        </div>
        <div className='space-y-2'>
          <Label className='text-gb-pastel-green-1'>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => onInputChange('description', e.target.value)}
            placeholder='Short description'
          />
        </div>
        <div className='flex items-center justify-between rounded-sm border p-3'>
          <div>
            <p className='font-medium'>Draft</p>
            <p className='text-xs text-muted-foreground'>Keep unpublished while editing.</p>
          </div>
          <Checkbox
            checked={formData.draft}
            onCheckedChange={(checked) => onInputChange('draft', checked === true)}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function EditorialContentCard({
  content,
  onChange
}: {
  content: string
  onChange: (value: string) => void
}) {
  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader>
        <CardTitle className='text-gb-pastel-green-1'>Content</CardTitle>
      </CardHeader>
      <CardContent>
        <SimpleMarkdownEditor
          value={content}
          onChange={onChange}
          placeholder='Write your post content in markdown...'
        />
      </CardContent>
    </Card>
  )
}

function ArtworkCard({
  artworkFile,
  artworkPreview,
  artworkUploadId,
  thumbnailUrl,
  onArtworkFileChange,
  onRemoveArtworkFile,
  onThumbnailUrlChange
}: {
  artworkFile: File | null
  artworkPreview: string | null
  artworkUploadId: string
  thumbnailUrl: string
  onArtworkFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveArtworkFile: () => void
  onThumbnailUrlChange: (value: string) => void
}) {
  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader>
        <CardTitle className='text-gb-pastel-green-1'>Artwork</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {!artworkFile && !thumbnailUrl ? (
          <label
            htmlFor={artworkUploadId}
            className='flex flex-col gap-3 justify-center items-center p-8 text-center rounded-sm border-2 border-dashed cursor-pointer transition-colors border-gb-pastel-green-2/40 hover:border-gb-highlight'>
            <ImageIcon className='size-8 text-gb-pastel-green-1' />
            <div>
              <p className='font-medium text-gb-pastel-green-1'>Upload artwork</p>
              <p className='text-xs text-gb-default-text'>PNG, JPG, WEBP up to 10MB</p>
            </div>
            <Upload className='size-4' />
          </label>
        ) : (
          <div className='relative p-3 rounded-sm border'>
            <img
              src={artworkPreview || thumbnailUrl}
              alt='Post artwork'
              className='object-cover w-full h-40 rounded-sm'
            />
            <Button
              type='button'
              size='icon'
              variant='destructive'
              className='absolute top-5 right-5 size-7'
              onClick={onRemoveArtworkFile}>
              <X className='size-4' />
            </Button>
          </div>
        )}
        <Input
          id={artworkUploadId}
          type='file'
          accept='image/*'
          onChange={onArtworkFileChange}
          className='hidden'
        />
        <div className='space-y-2'>
          <Label className='text-gb-pastel-green-1'>Or image URL</Label>
          <Input
            value={thumbnailUrl}
            onChange={(e) => onThumbnailUrlChange(e.target.value)}
            placeholder='https://...'
          />
        </div>
      </CardContent>
    </Card>
  )
}

function CreatorCard({
  selectedCreators,
  onSelectionChange
}: {
  selectedCreators: Array<{ id: string; name: string }>
  onSelectionChange: (users: Array<{ id: string; name: string }>) => void
}) {
  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader>
        <CardTitle className='text-gb-pastel-green-1'>Creator</CardTitle>
      </CardHeader>
      <CardContent>
        <UserSearch
          label='Post Creator'
          selectedUsers={selectedCreators}
          onSelectionChange={onSelectionChange}
        />
      </CardContent>
    </Card>
  )
}

export function EditorialPage() {
  const search = useSearch({ from: '/new/editorial' })
  const isEditMode = Boolean(search.edit)
  const queryClient = useQueryClient()
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user
  const artworkUploadId = useId()

  const [formData, setFormData] = useState<PostFormData>({
    title: '',
    description: '',
    slug: '',
    content: '',
    thumbnailUrl: '',
    tags: [],
    draft: false
  })
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null)
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading-image' | 'saving' | 'success'>(
    'idle'
  )
  const [selectedCreators, setSelectedCreators] = useState<Array<{ id: string; name: string }>>([])

  const { data: existingPost, isPending: loadingPost } = useQuery({
    queryKey: ['post', search.edit],
    queryFn: () => fetcher<PostItem>(`${VPS_BASE_URL}/content/posts/${search.edit}`),
    enabled: isEditMode && Boolean(search.edit)
  })

  useEffect(() => {
    if (!existingPost) return
    setFormData(toPostFormData(existingPost))
    setSelectedCreators(existingPost.creators || [])
  }, [existingPost])

  useEffect(() => {
    if (isEditMode || !user) return
    setSelectedCreators([{ id: user.id, name: user.name || 'You' }])
  }, [isEditMode, user])

  const canSave = Boolean(formData.title.trim() && formData.content.trim())

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
          throw new Error(
            await readResponseErrorMessage(imageUploadResponse, 'Failed to upload image file')
          )
        }

        const imageResult = await readUploadResponse(imageUploadResponse)
        imageUrl = imageResult.url
      }

      setUploadStep('saving')

      const generatedSlug = data.slug || generateSlug(data.title)
      const payload = {
        title: data.title.trim() || null,
        description: data.description,
        slug: generatedSlug || `post-${Date.now().toString(36)}`,
        content: data.content.trim() ? data.content : null,
        thumbnailUrl: imageUrl || null,
        tags: data.tags,
        draft: data.draft,
        type: 'post' as const,
        creatorIds:
          selectedCreators.length > 0 ? selectedCreators.map((creator) => creator.id) : [user.id]
      }

      const endpoint = isEditMode
        ? `${VPS_BASE_URL}/content/posts/${search.edit}`
        : `${VPS_BASE_URL}/content/post`

      return fetcher<PostItem>(endpoint, {
        method: isEditMode ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      })
    },
    onSuccess: async (savedPost) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['post', search.edit] }),
        queryClient.invalidateQueries({
          queryKey: ['post', 'editorial', savedPost.slug]
        }),
        queryClient.invalidateQueries({ queryKey: ['posts', 'editorials'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'posts', 'post'] })
      ])

      setUploadStep('success')
      toast({
        title: isEditMode ? 'Post updated' : 'Post created',
        description: `${savedPost.title || savedPost.slug} saved successfully.`
      })

      setTimeout(() => {
        router.navigate({
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

  const handleArtworkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setArtworkFile(file)
    setArtworkPreview(URL.createObjectURL(file))
  }

  const removeArtworkFile = () => {
    setArtworkFile(null)
    if (artworkPreview) {
      URL.revokeObjectURL(artworkPreview)
      setArtworkPreview(null)
    }
    setFormData((prev) => ({ ...prev, thumbnailUrl: '' }))
  }

  const handleInputChange = (field: keyof PostFormData, value: string | boolean) => {
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
      setFormData(toPostFormData(existingPost))
      return
    }

    setFormData({
      title: '',
      description: '',
      slug: '',
      content: '',
      thumbnailUrl: '',
      tags: [],
      draft: false
    })
    removeArtworkFile()
  }

  if (isEditMode && loadingPost) {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className='mr-2 size-6 animate-spin' />
        Loading post…
      </div>
    )
  }

  return (
    <div className='px-4 py-8 mx-auto max-w-6xl sm:px-6 lg:px-8'>
      <PostPageHeader
        title={isEditMode ? 'Edit Editorial' : 'Create Editorial'}
        description='Write and publish long-form editorial posts.'
        isEditMode={isEditMode}
        backLink={
          isEditMode && existingPost ? (
            <Link
              to='/editorial/$slug'
              params={{ slug: existingPost.slug }}
              className='inline-flex items-center gap-2 mb-3 text-sm text-muted-foreground hover:text-foreground'>
              <ArrowLeft className='w-4 h-4' />
              Back to post
            </Link>
          ) : undefined
        }
        switchLink={
          <Link
            to='/new/tweet'
            className='mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4'>
            Switch to tweet capture
          </Link>
        }
        actions={
          <>
            <Button variant='outline' onClick={handleDiscard} disabled={saveMutation.isPending}>
              Discard
            </Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={saveMutation.isPending || !canSave}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className='mr-2 size-4 animate-spin' />
                  {uploadStep === 'uploading-image' ? 'Uploading…' : 'Saving…'}
                </>
              ) : (
                <>
                  <Save className='mr-2 size-4' />
                  {isEditMode ? 'Update' : 'Publish'}
                </>
              )}
            </Button>
          </>
        }
      />

      <div className='grid gap-8 xl:grid-cols-[1fr_320px]'>
        <div className='space-y-6'>
          <EditorialDetailsCard formData={formData} onInputChange={handleInputChange} />
          <EditorialContentCard
            content={formData.content}
            onChange={(value) => handleInputChange('content', value)}
          />
        </div>

        <div className='space-y-6'>
          <ArtworkCard
            artworkFile={artworkFile}
            artworkPreview={artworkPreview}
            artworkUploadId={artworkUploadId}
            thumbnailUrl={formData.thumbnailUrl}
            onArtworkFileChange={handleArtworkFileChange}
            onRemoveArtworkFile={removeArtworkFile}
            onThumbnailUrlChange={(value) => handleInputChange('thumbnailUrl', value)}
          />

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
            contentTypeLabel='Editorial'
          />

          <CreatorCard
            selectedCreators={selectedCreators}
            onSelectionChange={(users) =>
              setSelectedCreators(users.length > 1 ? [users[users.length - 1]] : users)
            }
          />
        </div>
      </div>
    </div>
  )
}
