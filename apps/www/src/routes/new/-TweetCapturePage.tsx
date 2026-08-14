'use client'

import { canCreatePosts as roleCanCreatePosts } from '@gbfm/core/roles'
import { LINK_STATUS, type LinkStatus } from '@gbfm/core/status'
import { normalizeSlugBase } from '@gbfm/core/utils/slug'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  MusicEntityLinksPanel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast
} from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useRouter, useSearch } from '@tanstack/react-router'
import { ArrowLeft, Loader2, MessageSquareQuote, Music4, Send, Tag, X } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { PostPageHeader } from '@/components/PostPageHeader'
import { useSession } from '@/lib/auth-client'
import {
  apiUrl,
  extractTweetSlugFromText,
  fetcher,
  useAddAdminEntityLink,
  useAdminEntityLinks,
  useAdminRescrapeEntityLinks,
  useDeleteAdminEntityLink,
  useMicroPostBySlug,
  useMicroTags,
  useResolveMusicEntity,
  useUpdateAdminEntityLinkStatus
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
  quotedPostId?: string | null
  creators?: Array<{ id: string; name: string; username: string | null }>
  blueskySource?: {
    authorDid: string
    authorHandle: string | null
    publicUrl: string
    sourceCreatedAt: string
    sourceStatus: string
    locallyEdited: boolean
    lastError: string | null
  }
}

const entityPathByType = {
  album: 'albums',
  track: 'tracks',
  playlist: 'playlists'
} satisfies Record<MusicEntityType, string>

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
      <CardHeader className='pb-3'>
        <CardTitle className='text-base text-gb-pastel-green-1'>Post</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-1.5'>
          <div className='flex items-baseline justify-between'>
            <Label
              htmlFor='title'
              className='text-xs font-medium tracking-wide text-muted-foreground'>
              Title
            </Label>
            {title.length > 0 ? (
              <span className='text-xs tabular-nums text-muted-foreground'>{title.length}/255</span>
            ) : null}
          </div>
          <Input
            id='title'
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder='A short quip, e.g. “I dig this”'
            maxLength={255}
            autoFocus
          />
        </div>

        <div className='space-y-1.5'>
          <Label
            htmlFor='commentary'
            className='text-xs font-medium tracking-wide text-muted-foreground'>
            Commentary
          </Label>
          <Textarea
            id='commentary'
            value={commentary}
            onChange={(e) => onCommentaryChange(e.target.value)}
            placeholder='Optional commentary in markdown…'
            onKeyDown={onKeyDown}
            className='min-h-28'
          />
        </div>

        <div className='flex items-center gap-3 pt-1'>
          <Button onClick={onSubmit} disabled={!canSubmit || isPending} className='gap-2'>
            {isPending ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
            {isEditMode ? 'Update tweet' : 'Save tweet'}
          </Button>
          <span className='text-xs text-muted-foreground'>⌘↵ to submit</span>
        </div>
      </CardContent>
    </Card>
  )
}

function TweetTagsCard({
  tags,
  availableTags,
  newTag,
  onToggleTag,
  onNewTagChange,
  onAddNewTag
}: {
  tags: string[]
  availableTags: string[]
  newTag: string
  onToggleTag: (tag: string) => void
  onNewTagChange: (value: string) => void
  onAddNewTag: (event: KeyboardEvent<HTMLInputElement>) => void
}) {
  const customTags = tags.filter((tag) => !availableTags.includes(tag))

  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base text-gb-pastel-green-1'>
          <Tag className='size-4' />
          Tags
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {availableTags.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type='button'
                onClick={() => onToggleTag(tag)}
                className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-all ${
                  tags.includes(tag)
                    ? 'bg-gb-pastel-green-2 border-gb-pastel-green-2 text-gb-darker-bg'
                    : 'bg-transparent border-gb-pastel-green-2/30 text-gb-default-text hover:border-gb-highlight/50'
                }`}>
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className='relative'>
          <Tag className='absolute w-4 h-4 left-3 top-3.5 text-muted-foreground' />
          <Input
            value={newTag}
            onChange={(e) => onNewTagChange(e.target.value)}
            onKeyDown={onAddNewTag}
            placeholder='Add custom tag (Press Enter)'
            className='pl-10'
          />
        </div>

        {customTags.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {customTags.map((tag) => (
              <Badge
                key={tag}
                variant='secondary'
                className='flex items-center gap-1 bg-gb-pastel-green-2/20 text-gb-pastel-green-1'>
                {tag}
                <X
                  className='w-3 h-3 cursor-pointer hover:text-gb-highlight'
                  onClick={() => onToggleTag(tag)}
                />
              </Badge>
            ))}
          </div>
        )}
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
  hasEntity,
  onMusicUrlChange,
  linksSlot
}: {
  musicUrl: string
  displayedCoverImageUrl: string | null
  displayedEntityType: string | null
  displayedEntityTitle: string | null
  displayedArtistNames: string[] | null
  isResolving: boolean
  hasEntity: boolean
  onMusicUrlChange: (value: string) => void
  linksSlot?: ReactNode
}) {
  const metaLine = [displayedEntityType, displayedArtistNames?.join(', ')]
    .filter(Boolean)
    .join(' · ')

  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base text-gb-pastel-green-1'>
          <Music4 className='size-4' />
          Music
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-1.5'>
          <Label
            htmlFor='musicUrl'
            className='text-xs font-medium tracking-wide text-muted-foreground'>
            Music URL
          </Label>
          <div className='relative'>
            <Input
              id='musicUrl'
              value={musicUrl}
              onChange={(e) => onMusicUrlChange(e.target.value)}
              placeholder='https://open.spotify.com/track/...'
              className='pr-9'
            />
            {isResolving && (
              <Loader2 className='absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground' />
            )}
          </div>
        </div>

        <div className='flex items-center gap-3 rounded-md border border-gb-pastel-green-2/15 bg-black/20 p-2.5'>
          <div className='size-14 shrink-0 overflow-hidden rounded-sm bg-muted'>
            {displayedCoverImageUrl ? (
              <img
                src={displayedCoverImageUrl}
                alt='Cover art'
                className='size-full object-cover'
              />
            ) : (
              <div className='flex size-full items-center justify-center text-muted-foreground'>
                {isResolving ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <Music4 className='size-4' />
                )}
              </div>
            )}
          </div>
          <div className='min-w-0 flex-1'>
            <div className='truncate text-base font-medium'>
              {displayedEntityTitle || (isResolving ? 'Resolving…' : 'Paste a link to start')}
            </div>
            <div className='truncate text-xs capitalize text-muted-foreground'>
              {metaLine || (hasEntity ? '' : 'No entity resolved yet')}
            </div>
          </div>
        </div>

        {linksSlot ? <div>{linksSlot}</div> : null}
      </CardContent>
    </Card>
  )
}

function QuoteTweetCard({
  isResolving,
  resolvedTitle,
  resolvedContent
}: {
  isResolving: boolean
  resolvedTitle: string | null
  resolvedContent: string | null
}) {
  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base text-gb-pastel-green-1'>
          <MessageSquareQuote className='size-4' />
          Quoted tweet
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isResolving && (
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Loader2 className='size-3.5 animate-spin' />
            Resolving quoted tweet…
          </div>
        )}
        {!isResolving && (resolvedTitle || resolvedContent) && (
          <div className='flex items-center gap-3 rounded-md border border-gb-pastel-green-2/15 bg-black/20 p-2.5'>
            <MessageSquareQuote className='size-4 shrink-0 text-muted-foreground' />
            <div className='min-w-0 flex-1 truncate text-base text-muted-foreground'>
              {resolvedTitle || resolvedContent}
            </div>
          </div>
        )}
        {!isResolving && !resolvedTitle && !resolvedContent && (
          <p className='text-xs text-muted-foreground'>
            Paste a tweet link in the commentary to auto-attach it as a quote.
          </p>
        )}
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
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const [musicUrl, setMusicUrl] = useState('')
  const [title, setTitle] = useState('')
  const [commentary, setCommentary] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const { data: availableTags } = useMicroTags()

  const { data: existingPost, isPending: loadingPost } = useQuery({
    queryKey: ['post', search.edit],
    queryFn: () => fetcher<PostItem>(apiUrl(`/content/posts/${search.edit}/edit`)),
    enabled: isEditMode && Boolean(search.edit)
  })

  const { data: existingMusicEntity } = useQuery<MusicEntityPreview>({
    queryKey: ['music-entity', existingPost?.musicEntityType, existingPost?.musicEntityId],
    queryFn: () =>
      fetcher(
        apiUrl(
          `/music/${entityPathByType[existingPost?.musicEntityType ?? 'track']}/${existingPost?.musicEntityId}`
        )
      ),
    enabled: Boolean(existingPost?.musicEntityType && existingPost.musicEntityId)
  })

  const resolved = useResolveMusicEntity(musicUrl.trim())
  const quotedSlug = extractTweetSlugFromText(commentary)
  const resolvedQuote = useMicroPostBySlug(quotedSlug)

  useEffect(() => {
    if (!existingPost) return
    setTitle(existingPost.title ?? '')
    setCommentary(existingPost.content ?? '')
    setTags(existingPost.tags ?? [])
  }, [existingPost])

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((existing) => existing !== tag) : [...prev, tag]
    )
  }

  function addNewTag(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const trimmed = newTag.trim()
    if (trimmed && !tags.includes(trimmed)) {
      toggleTag(trimmed)
    }
    setNewTag('')
  }

  const canSubmit = useMemo(() => Boolean(title.trim() || commentary.trim()), [title, commentary])
  const canCreatePosts = roleCanCreatePosts(user?.role)
  const isOwnPost = Boolean(existingPost?.creators?.some((creator) => creator.id === user?.id))
  const canAccess = Boolean(
    user && (isEditMode ? user.role === 'admin' || isOwnPost : canCreatePosts)
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
  const rescrapeLinks = useAdminRescrapeEntityLinks()
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

  function handleRescrapeLinks() {
    if (!currentEntityType || !currentEntityId) return
    rescrapeLinks.mutate(
      { entityType: currentEntityType, entityId: currentEntityId },
      {
        onSuccess: () => toast({ title: 'Links rescraped' }),
        onError: (error) =>
          toast({
            title: 'Failed to rescrape links',
            description: error.message,
            variant: 'destructive'
          })
      }
    )
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
        tags,
        draft: existingPost?.draft ?? false,
        type: 'micro' as const,
        musicEntityType: resolved.data?.entityType ?? existingPost?.musicEntityType ?? null,
        musicEntityId: resolved.data?.entity?.id ?? existingPost?.musicEntityId ?? null,
        quotedPostId: resolvedQuote.data?.id ?? existingPost?.quotedPostId ?? null,
        creatorIds: creatorIds || undefined
      }

      const endpoint = isEditMode
        ? apiUrl(`/content/posts/${existingPost?.slug}`)
        : apiUrl('/content/post')

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

      void router.navigate({ to: '/tweet/$slug', params: { slug: savedPost.slug } })
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
            className='inline-flex items-center justify-center px-4 py-2 text-base font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90'>
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
              className='inline-flex items-center gap-2 mb-3 text-base text-muted-foreground hover:text-foreground'>
              <ArrowLeft className='w-4 h-4' />
              Back to tweet
            </Link>
          ) : undefined
        }
        switchLink={
          <Link
            to='/new/editorial'
            search={{ edit: undefined }}
            className='mt-2 inline-flex items-center gap-1 text-base text-muted-foreground hover:text-foreground underline underline-offset-4'>
            Switch to editorial
          </Link>
        }
      />

      {existingPost?.blueskySource ? (
        <Card className='mt-6 border-border'>
          <CardHeader>
            <CardTitle className='text-sm tracking-widest'>Bluesky source</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-xs text-muted-foreground'>
            <p>
              {existingPost.blueskySource.authorHandle ?? existingPost.blueskySource.authorDid} ·{' '}
              {existingPost.blueskySource.sourceStatus}
            </p>
            <a
              href={existingPost.blueskySource.publicUrl}
              target='_blank'
              rel='noreferrer'
              className='text-highlight underline underline-offset-4'>
              Open original post
            </a>
            {existingPost.blueskySource.lastError ? (
              <p className='text-destructive'>{existingPost.blueskySource.lastError}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {(() => {
        const composerCard = (
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
        )

        const musicCard = (
          <ResolvedMusicCard
            musicUrl={musicUrl}
            displayedCoverImageUrl={displayedCoverImageUrl}
            displayedEntityType={displayedEntityType}
            displayedEntityTitle={displayedEntityTitle}
            displayedArtistNames={displayedArtistNames}
            isResolving={resolved.isLoading}
            hasEntity={Boolean(currentEntityType && currentEntityId)}
            onMusicUrlChange={setMusicUrl}
            linksSlot={
              currentEntityType && currentEntityId ? (
                <MusicEntityLinksPanel
                  embedded
                  links={entityLinks.data ?? []}
                  readOnly={!canManageLinks}
                  onAdd={handleAddLink}
                  onEdit={handleEditLink}
                  onUpdateStatus={handleUpdateLinkStatus}
                  onDelete={handleDeleteLink}
                  onRescrape={canManageLinks ? handleRescrapeLinks : undefined}
                  isRescraping={rescrapeLinks.isPending}
                />
              ) : null
            }
          />
        )

        const tagsCard = (
          <TweetTagsCard
            tags={tags}
            availableTags={availableTags}
            newTag={newTag}
            onToggleTag={toggleTag}
            onNewTagChange={setNewTag}
            onAddNewTag={addNewTag}
          />
        )

        const quoteCard = quotedSlug ? (
          <QuoteTweetCard
            isResolving={resolvedQuote.isPending}
            resolvedTitle={resolvedQuote.data?.title ?? null}
            resolvedContent={resolvedQuote.data?.content ?? null}
          />
        ) : null

        if (!isDesktop) {
          return (
            <Tabs defaultValue='music' className='w-full'>
              <TabsList className='grid w-full grid-cols-3'>
                <TabsTrigger value='music'>Music</TabsTrigger>
                <TabsTrigger value='post'>Post</TabsTrigger>
                <TabsTrigger value='tags'>Tags</TabsTrigger>
              </TabsList>
              <TabsContent value='music'>{musicCard}</TabsContent>
              <TabsContent value='post' className='space-y-6'>
                {composerCard}
                {quoteCard}
              </TabsContent>
              <TabsContent value='tags'>{tagsCard}</TabsContent>
            </Tabs>
          )
        }

        return (
          <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'>
            <div className='space-y-6'>
              {composerCard}
              {tagsCard}
            </div>
            <div className='space-y-6'>
              {musicCard}
              {quoteCard}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
