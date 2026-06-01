'use client'

import { LINK_STATUS, type LinkStatus } from '@gbfm/core/status'
import { normalizeSlugBase } from '@gbfm/core/utils/slug'
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useRouter, useSearch } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Music4, Send } from 'lucide-react'
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { PostPageHeader } from '@/components/PostPageHeader'
import { useSession } from '@/lib/auth-client'
import {
  fetcher,
  useAddAdminEntityLink,
  useAdminEntityLinks,
  useDeleteAdminEntityLink,
  useResolveMusicEntity,
  useUpdateAdminEntityLinkStatus,
  VPS_BASE_URL
} from '@/lib/http'

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

const entityPathByType: Record<MusicEntityType, string> = {
  album: 'albums',
  track: 'tracks',
  playlist: 'playlists'
}

function TweetComposerCard({
  title,
  commentary,
  canSubmit,
  isEditMode,
  isPending,
  onTitleChange,
  onCommentaryChange,
  onSubmit,
  onKeyDown
}: {
  title: string
  commentary: string
  canSubmit: boolean
  isEditMode: boolean
  isPending: boolean
  onTitleChange: (value: string) => void
  onCommentaryChange: (value: string) => void
  onSubmit: () => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void
}) {
  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader>
        <CardTitle className='text-gb-pastel-green-1'>Post</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='title' className='text-gb-pastel-green-1'>
            Title
          </Label>
          <Input
            id='title'
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder='Optional title for the tweet'
            maxLength={255}
          />
          <p className='text-right text-xs text-muted-foreground'>{title.length}/255</p>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='commentary' className='text-gb-pastel-green-1'>
            Commentary
          </Label>
          <Textarea
            id='commentary'
            value={commentary}
            onChange={(e) => onCommentaryChange(e.target.value)}
            placeholder='Optional commentary in markdown…'
            onKeyDown={onKeyDown}
          />
        </div>

        <div className='flex items-center gap-3'>
          <Button onClick={onSubmit} disabled={!canSubmit || isPending} className='gap-2'>
            {isPending ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
            {isEditMode ? 'Update tweet' : 'Save tweet'}
          </Button>
          <span className='text-sm text-muted-foreground'>Cmd+Enter submits</span>
        </div>
      </CardContent>
    </Card>
  )
}

function ResolvedMusicCard({
  musicUrl,
  displayedCoverImageUrl,
  displayedEntityType,
  displayedEntityTitle,
  displayedArtistNames,
  isResolving,
  onMusicUrlChange
}: {
  musicUrl: string
  displayedCoverImageUrl: string | null
  displayedEntityType: string | null
  displayedEntityTitle: string | null
  displayedArtistNames: string[] | null
  isResolving: boolean
  onMusicUrlChange: (value: string) => void
}) {
  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-gb-pastel-green-1'>
          <Music4 className='size-5' />
          Music
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='musicUrl' className='text-gb-pastel-green-1'>
            Music URL
          </Label>
          <Input
            id='musicUrl'
            value={musicUrl}
            onChange={(e) => onMusicUrlChange(e.target.value)}
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
                {isResolving ? (
                  <Loader2 className='size-5 animate-spin' />
                ) : (
                  <Music4 className='size-5' />
                )}
              </div>
            )}
          </div>

          <div className='space-y-3'>
            <div>
              <div className='text-sm text-muted-foreground'>Resolved type</div>
              <div className='font-medium'>{displayedEntityType || 'Waiting for a URL'}</div>
            </div>
            <div>
              <div className='text-sm text-muted-foreground'>Title</div>
              <div className='font-medium'>{displayedEntityTitle || 'No entity resolved yet'}</div>
            </div>
            {displayedArtistNames?.length ? (
              <div>
                <div className='text-sm text-muted-foreground'>Artists</div>
                <div className='font-medium'>{displayedArtistNames.join(', ')}</div>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function TweetCapturePage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user
  const search = useSearch({ from: '/new/tweet' })
  const isEditMode = Boolean(search.edit)

  const [musicUrl, setMusicUrl] = useState('')
  const [title, setTitle] = useState('')
  const [commentary, setCommentary] = useState('')

  const { data: existingPost, isPending: loadingPost } = useQuery({
    queryKey: ['post', search.edit],
    queryFn: () => fetcher<PostItem>(`${VPS_BASE_URL}/content/posts/${search.edit}`),
    enabled: isEditMode && Boolean(search.edit)
  })

  const { data: existingMusicEntity } = useQuery<MusicEntityPreview>({
    queryKey: ['music-entity', existingPost?.musicEntityType, existingPost?.musicEntityId],
    queryFn: () =>
      fetcher(
        `${VPS_BASE_URL}/music/${entityPathByType[existingPost?.musicEntityType ?? 'track']}/${existingPost?.musicEntityId}`
      ),
    enabled: Boolean(existingPost?.musicEntityType && existingPost.musicEntityId)
  })

  const resolved = useResolveMusicEntity(musicUrl.trim())

  useEffect(() => {
    if (!existingPost) return
    setTitle(existingPost.title ?? '')
    setCommentary(existingPost.content ?? '')
  }, [existingPost])

  const canSubmit = useMemo(() => Boolean(title.trim() || commentary.trim()), [title, commentary])
  const canAccess = Boolean(
    user &&
    (user.role === 'admin' ||
      (isEditMode && existingPost?.creators?.some((creator) => creator.id === user.id)))
  )
  const displayedEntityType = resolved.data?.entityType ?? existingPost?.musicEntityType ?? null
  const displayedEntityTitle = resolved.data?.entity?.title ?? existingMusicEntity?.title ?? null
  const displayedCoverImageUrl =
    resolved.data?.coverImageUrl ?? existingMusicEntity?.coverImageUrl ?? null
  const displayedArtistNames =
    resolved.data?.entity?.artistNames ?? existingMusicEntity?.artistNames ?? null
  const currentEntityType = displayedEntityType
  const currentEntityId = resolved.data?.entity?.id ?? existingPost?.musicEntityId ?? null
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

  function handleSubmitShortcut(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.metaKey && event.key === 'Enter' && canSubmit && !submitMutation.isPending) {
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

      const slugBase = normalizeSlugBase(title.trim() || 'tweet') || 'tweet'
      const slug = existingPost?.slug ?? `${slugBase}-${Date.now().toString(36)}`
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
        musicEntityType: resolved.data?.entityType ?? existingPost?.musicEntityType ?? null,
        musicEntityId: resolved.data?.entity?.id ?? existingPost?.musicEntityId ?? null,
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
    onSuccess: async (savedPost) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['post', search.edit] }),
        queryClient.invalidateQueries({
          queryKey: ['post', 'micro', savedPost.slug]
        }),
        queryClient.invalidateQueries({ queryKey: ['posts', 'micro'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'posts', 'micro'] })
      ])

      toast({
        title: isEditMode ? 'Tweet updated' : 'Tweet captured',
        description: `Saved as ${savedPost.slug}`
      })

      router.navigate({ to: '/tweet/$slug', params: { slug: savedPost.slug } })
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to save tweet',
        description: error instanceof Error ? error.message : 'Something went wrong'
      })
    }
  })

  if (loadingPost && isEditMode) {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className='mr-2 size-6 animate-spin' />
        Loading tweet…
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
    <div className='px-4 py-8 mx-auto max-w-6xl sm:px-6 lg:px-8'>
      <PostPageHeader
        title={isEditMode ? 'Edit Tweet' : 'Tweet Capture'}
        description={
          isEditMode
            ? 'Update the tweet commentary or replace the attached music.'
            : 'Paste a music link, let the system resolve it, and capture the post fast.'
        }
        isEditMode={isEditMode}
        backLink={
          isEditMode && existingPost ? (
            <Link
              to='/tweet/$slug'
              params={{ slug: existingPost.slug }}
              className='inline-flex items-center gap-2 mb-3 text-sm text-muted-foreground hover:text-foreground'>
              <ArrowLeft className='w-4 h-4' />
              Back to tweet
            </Link>
          ) : undefined
        }
        switchLink={
          <Link
            to='/new/editorial'
            search={{ edit: undefined }}
            className='mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4'>
            Switch to editorial
          </Link>
        }
      />

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'>
        <TweetComposerCard
          title={title}
          commentary={commentary}
          canSubmit={canSubmit}
          isEditMode={isEditMode}
          isPending={submitMutation.isPending}
          onTitleChange={setTitle}
          onCommentaryChange={setCommentary}
          onSubmit={() => submitMutation.mutate()}
          onKeyDown={handleSubmitShortcut}
        />

        <div className='space-y-6'>
          <ResolvedMusicCard
            musicUrl={musicUrl}
            displayedCoverImageUrl={displayedCoverImageUrl}
            displayedEntityType={displayedEntityType}
            displayedEntityTitle={displayedEntityTitle}
            displayedArtistNames={displayedArtistNames}
            isResolving={resolved.isLoading}
            onMusicUrlChange={setMusicUrl}
          />

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
