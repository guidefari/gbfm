'use client'

import { canCreatePosts as roleCanCreatePosts } from '@gbfm/core/roles'
import { LINK_STATUS, type LinkStatus } from '@gbfm/core/status'
import { normalizeSlugBase } from '@gbfm/core/utils/slug'
import { MusicEntityLinksPanel, toast } from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { Loader2, MessageSquareQuote, Music4, X } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
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
  usePostTags,
  useUpdateAdminEntityLinkStatus
} from '@/lib/http'
import { useResolveMusicEntity } from '@/lib/music-entity-resolution'
import { ComposerCanvas } from './-ComposerCanvas'
import { ComposerHeader } from './-ComposerHeader'
import type { EditorialSaveState } from './-editorial-types'
import { TWEET_MAX_LENGTH } from './-tweet-hashtags'
import { useContentEdit } from './-useContentEdit'

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
}

const entityPathByType = {
  album: 'albums',
  track: 'tracks',
  playlist: 'playlists'
} satisfies Record<MusicEntityType, string>

const MUSIC_URL_PATTERN =
  /https?:\/\/(open\.spotify\.com|music\.apple\.com|[\w-]+\.bandcamp\.com|tidal\.com)\/\S+/i

function MusicCover({
  url,
  isResolving,
  size
}: {
  url: string | null
  isResolving: boolean
  size: 'md' | 'sm'
}) {
  const [failed, setFailed] = useState(false)
  const dimension = size === 'md' ? 'size-16' : 'size-12'
  const showImage = url && !failed

  return (
    <div className={`${dimension} flex shrink-0 items-center justify-center bg-muted`}>
      {showImage ? (
        <img
          src={url}
          alt='Cover art'
          className='size-full object-cover'
          onError={() => setFailed(true)}
        />
      ) : isResolving ? (
        <Loader2 className='size-4 animate-spin text-muted-foreground' />
      ) : (
        <Music4 className='size-5 text-muted-foreground' />
      )}
    </div>
  )
}

function MusicSlot({
  hasEntity,
  musicUrl,
  isResolving,
  coverImageUrl,
  entityTitle,
  entityMeta,
  onMusicUrlChange,
  onClear,
  linksSlot
}: {
  hasEntity: boolean
  musicUrl: string
  isResolving: boolean
  coverImageUrl: string | null
  entityTitle: string | null
  entityMeta: string
  onMusicUrlChange: (value: string) => void
  onClear: () => void
  linksSlot?: ReactNode
}) {
  if (!hasEntity) {
    return (
      <div className='flex h-14 items-center gap-3 border border-dashed border-gb-pastel-green-2/40 px-3 focus-within:border-highlight/60'>
        <Music4 className='size-4 shrink-0 text-muted-foreground' />
        <input
          value={musicUrl}
          onChange={(event) => onMusicUrlChange(event.target.value)}
          placeholder='Paste a Spotify, Apple Music or Bandcamp link'
          className='h-full min-w-0 flex-1 bg-transparent text-sm text-gb-pastel-green-2 outline-none'
        />
        {isResolving ? (
          <span className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Loader2 className='size-3.5 animate-spin' />
            Resolving…
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center gap-3 border border-gb-pastel-green-2/25 bg-black/20 p-2.5'>
        <MusicCover url={coverImageUrl} isResolving={isResolving} size='md' />
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <div className='truncate text-base font-medium text-gb-pastel-green-2'>{entityTitle}</div>
          <div className='truncate text-xs text-muted-foreground'>{entityMeta}</div>
          {musicUrl ? (
            <div className='truncate text-[11px] text-muted-foreground/75'>{musicUrl}</div>
          ) : null}
        </div>
        <button
          type='button'
          aria-label='Remove music'
          onClick={onClear}
          className='flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-highlight'>
          <X className='size-4' />
        </button>
      </div>
      {linksSlot}
    </div>
  )
}

function QuotedTweet({
  slug,
  isPending,
  title,
  content
}: {
  slug: string | null
  isPending: boolean
  title: string | null | undefined
  content: string | null | undefined
}) {
  if (!slug) return null
  return (
    <div className='border-t border-gb-pastel-green-2/15 pt-4'>
      <div className='flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground'>
        <MessageSquareQuote className='size-3.5' />
        Quoted tweet
      </div>
      {isPending ? (
        <div className='mt-2 flex items-center gap-2 text-xs text-muted-foreground'>
          <Loader2 className='size-3.5 animate-spin' />
          Resolving quoted tweet…
        </div>
      ) : title || content ? (
        <div className='mt-2 flex items-center gap-3 border border-gb-pastel-green-2/15 bg-black/20 p-2.5'>
          <MessageSquareQuote className='size-4 shrink-0 text-muted-foreground' />
          <div className='min-w-0 flex-1 truncate text-base text-muted-foreground'>
            {title || content}
          </div>
        </div>
      ) : (
        <p className='mt-2 text-xs text-muted-foreground'>
          Paste a tweet link in the commentary to auto-attach it as a quote.
        </p>
      )}
    </div>
  )
}

export function TweetComposer({ editSlug }: { editSlug: string | undefined }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user

  const [musicUrl, setMusicUrl] = useState('')
  const [tweet, setTweet] = useState('')
  const [commentary, setCommentary] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [pendingMusicCount, setPendingMusicCount] = useState(0)
  const { data: availableTags } = usePostTags()

  const {
    isEditMode,
    data: existingPost,
    isPending: loadingPost
  } = useContentEdit<PostItem>(editSlug)

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

  const resolved = useResolveMusicEntity(musicUrl.trim(), 'tweet')
  const quotedSlug = extractTweetSlugFromText(commentary)
  const resolvedQuote = useMicroPostBySlug(quotedSlug)

  const restoredRef = useRef(false)
  useEffect(() => {
    if (!existingPost || restoredRef.current) return
    restoredRef.current = true
    setTweet(existingPost.title ?? '')
    setCommentary(existingPost.content ?? '')
    setTags(existingPost.tags ?? [])
  }, [existingPost])

  const tweetCount = tweet.length

  function handleTweetChange(value: string) {
    const musicMatch =
      !resolved.data && !musicUrl && !hasEntity ? value.match(MUSIC_URL_PATTERN) : null
    if (musicMatch) {
      setTweet(value.replace(musicMatch[0], '').replace(/[ \t]{2,}/g, ' '))
      setMusicUrl(musicMatch[0])
    } else {
      setTweet(value)
    }
  }

  function addTag(tag: string) {
    setTags((previous) => Array.from(new Set([...previous, tag])))
  }

  function removeTag(tag: string) {
    setTags((previous) => previous.filter((existing) => existing !== tag))
  }

  function clearMusic() {
    setMusicUrl('')
  }

  const canSubmit = useMemo(
    () =>
      Boolean(
        (tweet.trim() || commentary.trim()) &&
        tweetCount <= TWEET_MAX_LENGTH &&
        pendingMusicCount === 0
      ),
    [tweet, commentary, tweetCount, pendingMusicCount]
  )
  const canCreatePosts = roleCanCreatePosts(user?.role)
  const isOwnPost = Boolean(existingPost?.creators?.some((creator) => creator.id === user?.id))
  const canAccess = Boolean(
    user && (isEditMode ? user.role === 'admin' || isOwnPost : canCreatePosts)
  )
  const displayedEntityType = resolved.data?.entityType ?? existingPost?.musicEntityType ?? null
  const displayedEntityTitle = resolved.data?.entity?.title ?? existingMusicEntity?.title ?? null
  const displayedCoverImageUrl =
    resolved.data?.coverImageUrl ?? existingMusicEntity?.coverImageUrl ?? null
  const resolvedArtistNames =
    resolved.data && 'artistNames' in resolved.data.entity ? resolved.data.entity.artistNames : null
  const displayedArtistNames = resolvedArtistNames ?? existingMusicEntity?.artistNames ?? null
  const currentEntityType = displayedEntityType
  const currentEntityId = resolved.data?.entity?.id ?? existingPost?.musicEntityId ?? null
  const hasEntity = Boolean(currentEntityType && currentEntityId)
  const entityMeta = [displayedEntityType, displayedArtistNames?.join(', ')]
    .filter(Boolean)
    .join(' · ')

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

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error('Please sign in')
      }

      if (isEditMode && !existingPost) {
        throw new Error('Tweet is still loading')
      }

      const title = tweet.trim() || null
      const slugBase = normalizeSlugBase(tweet.trim() || 'tweet') || 'tweet'
      const slug = existingPost?.slug ?? `${slugBase}-${Date.now().toString(36)}`
      const creatorIds = isEditMode
        ? existingPost?.creators?.map((creator) => creator.id)
        : [user.id]

      const payload = {
        title,
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
        queryClient.invalidateQueries({ queryKey: ['post', editSlug] }),
        queryClient.invalidateQueries({
          queryKey: ['post', 'micro', savedPost.slug]
        }),
        queryClient.invalidateQueries({ queryKey: ['posts', 'micro'] }),
        queryClient.invalidateQueries({ queryKey: ['posts', 'tags'] }),
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

  const saveState: EditorialSaveState = submitMutation.isPending
    ? 'saving'
    : submitMutation.isError
      ? 'error'
      : submitMutation.isSuccess
        ? 'saved'
        : 'unsaved'

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
      <div className='flex min-h-screen items-center justify-center p-4'>
        <div className='text-center'>
          <p className='mb-4 text-lg text-gray-600'>
            {!user
              ? 'Please sign in to access tweet capture'
              : 'You can only edit tweets you created'}
          </p>
          <Link
            to={!user ? '/auth/sign-in' : '/'}
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:bg-primary/90'>
            {!user ? 'Sign In' : 'Go Home'}
          </Link>
        </div>
      </div>
    )
  }

  const overLimit = tweetCount > TWEET_MAX_LENGTH
  const navigation =
    isEditMode && existingPost ? (
      <Link
        to='/tweet/$slug'
        params={{ slug: existingPost.slug }}
        className='inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground'>
        Back to tweet
      </Link>
    ) : null

  return (
    <div className='text-foreground'>
      <ComposerHeader
        navigation={navigation}
        saveState={saveState}
        isSaving={submitMutation.isPending}
        canSave={canSubmit}
        primaryLabel={isEditMode ? 'Update tweet' : 'Save tweet'}
        onDiscard={() => {
          setTweet('')
          setCommentary('')
          setTags([])
          setMusicUrl('')
        }}
        onPublish={() => submitMutation.mutate()}
      />

      <ComposerCanvas
        title={tweet}
        titlePlaceholder='A short quip, e.g. “I dig this”'
        titleHint={
          <span
            className={`tabular-nums text-xs ${
              overLimit
                ? 'text-destructive'
                : tweetCount > 230
                  ? 'text-yellow-500'
                  : 'text-muted-foreground'
            }`}>
            {tweetCount}/{TWEET_MAX_LENGTH}
          </span>
        }
        content={commentary}
        tags={tags}
        availableTags={availableTags}
        contentPlaceholder='Why this one? Paste a tweet link here to quote it.'
        contentTypeLabel='Tweet'
        resolutionScope='tweet'
        onTitleChange={handleTweetChange}
        onContentChange={setCommentary}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onPendingMusicChange={setPendingMusicCount}
        musicSlot={
          <MusicSlot
            hasEntity={hasEntity}
            musicUrl={musicUrl}
            isResolving={resolved.isLoading}
            coverImageUrl={displayedCoverImageUrl}
            entityTitle={displayedEntityTitle}
            entityMeta={entityMeta}
            onMusicUrlChange={setMusicUrl}
            onClear={clearMusic}
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
        }
        belowEditorSlot={
          <QuotedTweet
            slug={quotedSlug}
            isPending={resolvedQuote.isPending}
            title={resolvedQuote.data?.title}
            content={resolvedQuote.data?.content}
          />
        }
      />
    </div>
  )
}
