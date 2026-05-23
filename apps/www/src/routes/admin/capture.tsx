import { LINK_STATUS, type LinkStatus } from '@gbfm/core/status'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  MusicEntityLinksPanel,
  Textarea,
  toast
} from '@gbfm/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Music4, Send } from 'lucide-react'
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react'
import {
  fetcher,
  useAddAdminEntityLink,
  useAdminEntityLinks,
  useDeleteAdminEntityLink,
  useResolveMusicEntity,
  useUpdateAdminEntityLinkStatus,
  VPS_BASE_URL
} from '@/lib/http'
import { useSession } from '@/lib/auth-client'

type PostType = 'post' | 'micro'
type MusicEntityType = 'album' | 'track' | 'playlist'

type MusicEntityPreview = {
  id: string
  title: string
  coverImageUrl: string | null
  slug: string
  artistNames?: string[] | null
  description?: string | null
}

const entityPathByType: Record<MusicEntityType, string> = {
  album: 'albums',
  track: 'tracks',
  playlist: 'playlists'
}

interface PostItem {
  id: string
  title: string | null
  description: string | null
  slug: string
  content: string | null
  thumbnailUrl: string | null
  tags: string[] | null
  draft: boolean
  type: PostType | null
  musicEntityType: MusicEntityType | null
  musicEntityId: string | null
  creators?: Array<{ id: string; name: string; username: string | null }>
}

export const Route = createFileRoute('/admin/capture')({
  validateSearch: (search) => ({
    edit: typeof search.edit === 'string' ? search.edit : undefined
  }),
  component: MusicCapturePage
})

const generateSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

function MusicCapturePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user
  const search = Route.useSearch()
  const isEditMode = Boolean(search.edit)

  const [musicUrl, setMusicUrl] = useState('')
  const [title, setTitle] = useState('')
  const [commentary, setCommentary] = useState('')

  const { data: existingPost, isPending: loadingPost } = useQuery({
    queryKey: ['post', search.edit],
    queryFn: () =>
      fetcher<PostItem>(`${VPS_BASE_URL}/content/posts/${search.edit}`),
    enabled: isEditMode && Boolean(search.edit)
  })

  const { data: existingMusicEntity } = useQuery<MusicEntityPreview>({
    queryKey: [
      'music-entity',
      existingPost?.musicEntityType,
      existingPost?.musicEntityId
    ],
    queryFn: () =>
      fetcher(
        `${VPS_BASE_URL}/music/${entityPathByType[existingPost?.musicEntityType ?? 'track']}/${existingPost?.musicEntityId}`
      ),
    enabled: Boolean(
      existingPost?.musicEntityType && existingPost.musicEntityId
    )
  })

  const resolved = useResolveMusicEntity(musicUrl.trim())

  useEffect(() => {
    if (!existingPost) return
    setTitle(existingPost.title ?? '')
    setCommentary(existingPost.content ?? '')
  }, [existingPost])

  const canSubmit = useMemo(() => {
    return Boolean(title.trim() || commentary.trim())
  }, [title, commentary])

  const canAccess = Boolean(
    user &&
      (user.role === 'admin' ||
        (isEditMode &&
          existingPost?.creators?.some((creator) => creator.id === user.id)))
  )
  const displayedEntityType =
    resolved.data?.entityType ?? existingPost?.musicEntityType ?? null
  const displayedEntityTitle =
    resolved.data?.entity?.title ?? existingMusicEntity?.title ?? null
  const displayedCoverImageUrl =
    resolved.data?.coverImageUrl ?? existingMusicEntity?.coverImageUrl ?? null
  const displayedArtistNames =
    resolved.data?.entity?.artistNames ??
    existingMusicEntity?.artistNames ??
    null
  const currentEntityType = displayedEntityType
  const currentEntityId =
    resolved.data?.entity?.id ?? existingPost?.musicEntityId ?? null
  const entityLinks = useAdminEntityLinks(
    currentEntityType ?? '',
    currentEntityId ?? '',
    Boolean(currentEntityType && currentEntityId)
  )
  const addLink = useAddAdminEntityLink()
  const updateLinkStatus = useUpdateAdminEntityLinkStatus()
  const deleteLink = useDeleteAdminEntityLink()
  const canManageLinks = user?.role === 'admin'

  function handleAddLink(platform: string, url: string) {
    if (!currentEntityType || !currentEntityId) return
    addLink.mutate(
      {
        entityType: currentEntityType,
        entityId: currentEntityId,
        platform,
        url,
        status: LINK_STATUS.VERIFIED
      },
      {
        onError: (error) =>
          toast({
            title: 'Failed to add link',
            description: error.message,
            variant: 'destructive'
          })
      }
    )
  }

  function handleEditLink(linkId: string, platform: string, url: string) {
    if (!currentEntityType || !currentEntityId) return
    const existingLink = entityLinks.data?.find((link) => link.id === linkId)
    addLink.mutate(
      {
        entityType: currentEntityType,
        entityId: currentEntityId,
        platform,
        url,
        status: LINK_STATUS.VERIFIED
      },
      {
        onSuccess: () => {
          if (existingLink && existingLink.platform !== platform) {
            deleteLink.mutate({
              entityType: currentEntityType,
              entityId: currentEntityId,
              linkId
            })
          }
        },
        onError: (error) =>
          toast({
            title: 'Failed to edit link',
            description: error.message,
            variant: 'destructive'
          })
      }
    )
  }

  function handleUpdateLinkStatus(linkId: string, status: LinkStatus) {
    if (!currentEntityType || !currentEntityId) return
    updateLinkStatus.mutate({
      entityType: currentEntityType,
      entityId: currentEntityId,
      linkId,
      status
    })
  }

  function handleDeleteLink(linkId: string) {
    if (!currentEntityType || !currentEntityId) return
    deleteLink.mutate({
      entityType: currentEntityType,
      entityId: currentEntityId,
      linkId
    })
  }

  function handleSubmitShortcut(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    if (
      event.metaKey &&
      event.key === 'Enter' &&
      canSubmit &&
      !submitMutation.isPending
    ) {
      event.preventDefault()
      submitMutation.mutate()
    }
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error('Please sign in')
      }

      if (isEditMode && !existingPost) {
        throw new Error('Tweet is still loading')
      }

      const slugBase = generateSlug(title.trim() || 'tweet')
      const slug =
        existingPost?.slug ?? `${slugBase}-${Date.now().toString(36)}`
      const creatorIds = isEditMode
        ? existingPost?.creators?.map((creator) => creator.id)
        : [user.id]

      const payload = {
        title: title.trim() || null,
        description: existingPost?.description ?? undefined,
        slug,
        content: commentary.trim() ? commentary : null,
        thumbnailUrl: existingPost?.thumbnailUrl ?? undefined,
        tags: existingPost?.tags ?? [],
        draft: existingPost?.draft ?? false,
        type: 'micro' as const,
        musicEntityType:
          resolved.data?.entityType ?? existingPost?.musicEntityType ?? null,
        musicEntityId:
          resolved.data?.entity?.id ?? existingPost?.musicEntityId ?? null,
        ...(creatorIds ? { creatorIds } : {})
      }

      const endpoint = isEditMode
        ? `${VPS_BASE_URL}/content/posts/${existingPost?.slug}`
        : `${VPS_BASE_URL}/content/post`

      return fetcher<PostItem>(endpoint, {
        method: isEditMode ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      })
    },
    onSuccess: (savedPost) => {
      toast({
        title: isEditMode ? 'Tweet updated' : 'Tweet captured',
        description: `Saved as ${savedPost.slug}`
      })

      router.navigate({ to: `/tweet/${savedPost.slug}` })
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to save tweet',
        description:
          error instanceof Error ? error.message : 'Something went wrong'
      })
    }
  })

  if (loadingPost && isEditMode) {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className='w-6 h-6 mr-2 animate-spin' />
        Loading tweet...
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className='flex items-center justify-center min-h-screen p-4'>
        <div className='text-center'>
          <p className='mb-4 text-lg text-gray-600'>
            {!user
              ? 'Please sign in to access tweet capture'
              : 'You can only edit tweets you created'}
          </p>
          <Link
            to={!user ? '/auth/sign-in' : '/'}
            className='inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90'>
            {!user ? 'Sign In' : 'Go Home'}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className='container max-w-6xl py-8 mx-auto space-y-6'>
      <div className='flex items-center justify-between gap-4'>
        <div>
          {isEditMode && existingPost ? (
            <Link
              to='/tweet/$slug'
              params={{ slug: existingPost.slug }}
              className='inline-flex items-center gap-2 mb-3 text-sm text-muted-foreground hover:text-foreground'>
              <ArrowLeft className='w-4 h-4' />
              Back to tweet
            </Link>
          ) : (
            <Link
              to='/admin'
              className='inline-flex items-center gap-2 mb-3 text-sm text-muted-foreground hover:text-foreground'>
              <ArrowLeft className='w-4 h-4' />
              Back to admin
            </Link>
          )}
          <h1 className='text-3xl font-black tracking-tight'>
            {isEditMode ? 'Edit Tweet' : 'Tweet Capture'}
          </h1>
          <p className='mt-2 text-muted-foreground'>
            {isEditMode
              ? 'Update the tweet commentary or replace the attached music.'
              : 'Paste a music link, let the system resolve it, and capture the post fast.'}
          </p>
        </div>
        {user?.role === 'admin' && (
          <Button asChild variant='outline'>
            <Link to='/admin/overview'>Overview</Link>
          </Button>
        )}
      </div>

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'>
        <Card>
          <CardHeader>
            <CardTitle>Post</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='title'>Title</Label>
              <Input
                id='title'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleSubmitShortcut}
                placeholder='Optional title for the tweet'
                maxLength={255}
              />
              <p className='text-right text-xs text-muted-foreground'>
                {title.length}/255
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='commentary'>Commentary</Label>
              <Textarea
                id='commentary'
                value={commentary}
                onChange={(e) => setCommentary(e.target.value)}
                placeholder='Optional commentary in markdown...'
                onKeyDown={handleSubmitShortcut}
              />
            </div>

            <div className='flex items-center gap-3'>
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={!canSubmit || submitMutation.isPending}
                className='gap-2'>
                {submitMutation.isPending ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                  <Send className='w-4 h-4' />
                )}
                {isEditMode ? 'Update tweet' : 'Save tweet'}
              </Button>
              <span className='text-sm text-muted-foreground'>
                Cmd+Enter submits
              </span>
            </div>
          </CardContent>
        </Card>

        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Music4 className='w-5 h-5' />
                Music
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='musicUrl'>Music URL</Label>
                <Input
                  id='musicUrl'
                  value={musicUrl}
                  onChange={(e) => setMusicUrl(e.target.value)}
                  placeholder='https://open.spotify.com/track/...'
                />
              </div>

              <div className='grid gap-4 sm:grid-cols-[120px_1fr] lg:grid-cols-1'>
                <div className='overflow-hidden border rounded-lg bg-muted aspect-square'>
                  {displayedCoverImageUrl ? (
                    <img
                      src={displayedCoverImageUrl}
                      alt='Cover art'
                      className='object-cover w-full h-full'
                    />
                  ) : (
                    <div className='flex items-center justify-center h-full text-muted-foreground'>
                      {resolved.isLoading ? (
                        <Loader2 className='w-5 h-5 animate-spin' />
                      ) : (
                        <Music4 className='w-5 h-5' />
                      )}
                    </div>
                  )}
                </div>

                <div className='space-y-3'>
                  <div>
                    <div className='text-sm text-muted-foreground'>
                      Resolved type
                    </div>
                    <div className='font-medium'>
                      {displayedEntityType || 'Waiting for a URL'}
                    </div>
                  </div>
                  <div>
                    <div className='text-sm text-muted-foreground'>Title</div>
                    <div className='font-medium'>
                      {displayedEntityTitle || 'No entity resolved yet'}
                    </div>
                  </div>
                  {displayedArtistNames?.length ? (
                    <div>
                      <div className='text-sm text-muted-foreground'>
                        Artists
                      </div>
                      <div className='font-medium'>
                        {displayedArtistNames.join(', ')}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {currentEntityType && currentEntityId ? (
            <MusicEntityLinksPanel
              links={entityLinks.data ?? []}
              readOnly={!canManageLinks}
              onAdd={handleAddLink}
              onEdit={handleEditLink}
              onUpdateStatus={handleUpdateLinkStatus}
              onDelete={handleDeleteLink}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
