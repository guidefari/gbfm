'use client'

import { canCreatePosts as roleCanCreatePosts } from '@gbfm/core/roles'
import { LINK_STATUS, type LinkStatus } from '@gbfm/core/status'
import { normalizeSlugBase } from '@gbfm/core/utils/slug'
import { Button, Label, MusicEntityLinksPanel, Textarea, toast } from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Loader2, MessageSquareQuote, Music4, Send, Tag, X } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
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
  usePostTags,
  useUpdateAdminEntityLinkStatus
} from '@/lib/http'
import { useContentEdit } from './-useContentEdit'
import { useResolveMusicEntity } from '@/lib/music-entity-resolution'
import {
  type ActiveField,
  type HashtagSuggestion,
  TWEET_MAX_LENGTH,
  activeFragment,
  appendHashtag,
  completeFragment,
  extractHashtags,
  removeHashtag,
  stripHashtags,
  suggestHashtags,
  toTagToken
} from './-tweet-hashtags'

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

function HashtagPopover({
  suggestions,
  highlightIndex,
  onPick,
  onHover
}: {
  suggestions: HashtagSuggestion[]
  highlightIndex: number
  onPick: (tag: string) => void
  onHover: (index: number) => void
}) {
  const activeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  return (
    <div className='absolute inset-x-6 z-10 mt-1 flex max-h-64 flex-col overflow-y-auto border border-highlight/40 bg-gb-darker-bg shadow-2xl'>
      {suggestions.map((suggestion, index) => {
        const active = index === highlightIndex
        return (
          <button
            key={suggestion.label}
            ref={active ? activeRef : undefined}
            type='button'
            onMouseEnter={() => onHover(index)}
            onMouseDown={(event) => {
              event.preventDefault()
              onPick(suggestion.label)
            }}
            className={`flex items-center justify-between px-3 py-2 text-sm text-gb-pastel-green-2 ${
              active ? 'bg-muted' : ''
            }`}>
            <span>
              <span className='text-highlight'>#</span>
              {suggestion.label}
            </span>
            <span className='text-xs text-muted-foreground'>
              {suggestion.isNew ? 'new tag' : active ? '↵ add' : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ComposerField({
  id,
  label,
  hint,
  value,
  placeholder,
  minRows,
  fontSize,
  suggestions,
  highlightIndex,
  onChange,
  onKeyDown,
  onFocus,
  onPickSuggestion,
  onHoverSuggestion
}: {
  id: string
  label: ReactNode
  hint?: ReactNode
  value: string
  placeholder: string
  minRows: 'md' | 'sm'
  fontSize: 'lg' | 'base'
  suggestions: HashtagSuggestion[]
  highlightIndex: number
  onChange: (value: string, caret: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onFocus: () => void
  onPickSuggestion: (tag: string) => void
  onHoverSuggestion: (index: number) => void
}) {
  return (
    <div className='relative flex flex-col gap-2'>
      <Label
        htmlFor={id}
        className='flex justify-between gap-3 text-xs font-medium tracking-wide text-muted-foreground'>
        <span>{label}</span>
        {hint ? <span>{hint}</span> : null}
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value, event.target.selectionStart ?? 0)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        className={`resize-none border-0 bg-transparent p-0 leading-relaxed text-gb-pastel-green-2 focus-visible:ring-0 ${
          minRows === 'md' ? 'min-h-24' : 'min-h-16'
        } ${fontSize === 'lg' ? 'text-xl font-medium' : 'text-base'}`}
      />
      {suggestions.length > 0 ? (
        <HashtagPopover
          suggestions={suggestions}
          highlightIndex={highlightIndex}
          onPick={onPickSuggestion}
          onHover={onHoverSuggestion}
        />
      ) : null}
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

function TagRow({
  tags,
  recentTags,
  onRemove,
  onAddRecent
}: {
  tags: Array<{ name: string; isNew: boolean }>
  recentTags: string[]
  onRemove: (tag: string) => void
  onAddRecent: (tag: string) => void
}) {
  return (
    <div className='flex min-h-8 flex-wrap items-center gap-2 border-t border-gb-pastel-green-2/15 pt-4'>
      <Tag className='size-3.5 text-muted-foreground' />
      {tags.map((tag) => (
        <span
          key={tag.name}
          className='flex items-center gap-1.5 bg-gb-pastel-green-2 py-1 pl-2.5 pr-1.5 text-xs font-semibold text-gb-darker-bg'>
          {tag.name}
          {tag.isNew ? (
            <span className='bg-gb-darker-bg px-1 text-[10px] text-highlight'>new</span>
          ) : null}
          <button
            type='button'
            aria-label={`Remove ${tag.name}`}
            onClick={() => onRemove(tag.name)}
            className='flex text-gb-darker-bg'>
            <X className='size-3' />
          </button>
        </span>
      ))}
      <span className='ml-1 text-xs text-muted-foreground'>
        {tags.length > 0 ? '' : 'Type # in the tweet, or'}
      </span>
      {recentTags.map((tag) => (
        <button
          key={tag}
          type='button'
          onClick={() => onAddRecent(tag)}
          className='border border-dashed border-gb-pastel-green-2/45 px-2 py-0.5 text-xs font-medium text-gb-pastel-green-2 hover:border-solid hover:text-highlight'>
          #{tag}
        </button>
      ))}
    </div>
  )
}

function TweetPreview({
  slug,
  authorName,
  handle,
  avatarUrl,
  previewText,
  hasText,
  commentary,
  hasEntity,
  entityTitle,
  entityMeta,
  coverImageUrl,
  tags
}: {
  slug: string
  authorName: string
  handle: string
  avatarUrl: string | null
  previewText: string
  hasText: boolean
  commentary: string
  hasEntity: boolean
  entityTitle: string | null
  entityMeta: string
  coverImageUrl: string | null
  tags: string[]
}) {
  return (
    <aside className='top-0 flex flex-col gap-2.5 lg:sticky'>
      <div className='flex justify-between text-xs font-medium tracking-wide text-muted-foreground'>
        <span>Preview</span>
        <span className='opacity-75'>/tweet/{slug}</span>
      </div>
      <div className='flex flex-col gap-3.5 border border-gb-pastel-green-2/20 bg-gb-darker-bg p-5'>
        <div className='flex items-center gap-3'>
          <div className='flex size-10 shrink-0 items-center justify-center overflow-hidden bg-muted text-base font-bold text-gb-pastel-green-2 outline outline-1 outline-border/60'>
            {avatarUrl ? (
              <img src={avatarUrl} alt={authorName} className='size-full object-cover' />
            ) : (
              authorName.charAt(0).toUpperCase()
            )}
          </div>
          <div className='leading-tight'>
            <div className='text-sm font-bold text-gb-pastel-green-2'>{authorName}</div>
            <div className='flex items-center gap-1.5 text-[13px] text-muted-foreground'>
              @{handle}
              <span className='opacity-50'>·</span>
              <span className='text-[11px] opacity-70'>{format(new Date(), 'LLL d, yyyy')}</span>
            </div>
          </div>
        </div>
        <div
          className={`whitespace-pre-wrap break-words text-lg leading-relaxed ${
            hasText ? 'text-gb-pastel-green-2' : 'text-muted-foreground/60'
          }`}>
          {previewText}
        </div>
        {commentary ? (
          <div className='whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground'>
            {commentary}
          </div>
        ) : null}
        {hasEntity ? (
          <div className='flex items-center gap-3 border border-gb-pastel-green-2/15 bg-black/20 p-2'>
            <MusicCover url={coverImageUrl} isResolving={false} size='sm' />
            <div>
              <div className='text-sm font-medium text-gb-pastel-green-2'>{entityTitle}</div>
              <div className='text-xs text-muted-foreground'>{entityMeta}</div>
            </div>
          </div>
        ) : null}
        {tags.length > 0 ? (
          <div className='flex flex-wrap gap-x-3 gap-y-1'>
            {tags.map((tag) => (
              <span key={tag} className='text-xs font-medium text-muted-foreground'>
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <p className='text-xs leading-relaxed text-muted-foreground'>
        Paste a music link into the tweet and it’s attached automatically.
      </p>
    </aside>
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
  const [activeField, setActiveField] = useState<ActiveField>('tweet')
  const [caret, setCaret] = useState(0)
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
    const restoredTags = (existingPost.tags ?? []).map(toTagToken)
    const title = existingPost.title ?? ''
    const inline = restoredTags.reduce((text, tag) => appendHashtag(text, tag), title)
    setTweet(inline)
    setCommentary(existingPost.content ?? '')
  }, [existingPost])

  const tags = useMemo(() => extractHashtags(tweet, commentary), [tweet, commentary])
  const publishedTweet = useMemo(() => stripHashtags(tweet), [tweet])
  const publishedCommentary = useMemo(() => stripHashtags(commentary), [commentary])
  const tweetCount = publishedTweet.length

  const [dismissedStart, setDismissedStart] = useState<number | null>(null)

  const suggestions = useMemo(() => {
    const source = activeField === 'tweet' ? tweet : commentary
    const fragment = activeFragment(source, caret)
    if (!fragment) return []
    if (dismissedStart === fragment.start) return []
    return suggestHashtags(fragment.query, availableTags, tags)
  }, [activeField, tweet, commentary, caret, availableTags, tags, dismissedStart])

  const [highlightIndex, setHighlightIndex] = useState(0)
  useEffect(() => {
    setHighlightIndex(0)
  }, [suggestions])

  const recentTags = useMemo(() => {
    const seed = availableTags.slice(0, 5).map(toTagToken)
    const available = seed.filter((tag) => !tags.includes(tag))
    return available.slice(0, tags.length > 0 ? 3 : 4)
  }, [availableTags, tags])

  const tagChips = useMemo(() => {
    const known = new Set(availableTags.map(toTagToken))
    return tags.map((name) => ({ name, isNew: !known.has(name) }))
  }, [tags, availableTags])

  function handleTweetChange(value: string, nextCaret: number) {
    const musicMatch =
      !resolved.data && !musicUrl && !hasEntity ? value.match(MUSIC_URL_PATTERN) : null
    if (musicMatch) {
      setTweet(value.replace(musicMatch[0], '').replace(/[ \t]{2,}/g, ' '))
      setMusicUrl(musicMatch[0])
    } else {
      setTweet(value)
    }
    setActiveField('tweet')
    setCaret(nextCaret)
    setDismissedStart(null)
  }

  function handleCommentaryChange(value: string, nextCaret: number) {
    setCommentary(value)
    setActiveField('commentary')
    setCaret(nextCaret)
    setDismissedStart(null)
  }

  function pickSuggestion(field: ActiveField, tag: string) {
    const source = field === 'tweet' ? tweet : commentary
    const fragment = activeFragment(source, caret)
    if (!fragment) return
    const next = completeFragment(source, fragment, tag)
    if (field === 'tweet') setTweet(next)
    else setCommentary(next)
    setCaret(next.length)
  }

  function addRecentTag(tag: string) {
    setTweet((prev) => appendHashtag(prev, tag))
  }

  function removeTag(tag: string) {
    setTweet((prev) => removeHashtag(prev, tag))
    setCommentary((prev) => removeHashtag(prev, tag))
  }

  function clearMusic() {
    setMusicUrl('')
  }

  const canSubmit = useMemo(
    () => Boolean((publishedTweet || publishedCommentary) && tweetCount <= TWEET_MAX_LENGTH),
    [publishedTweet, publishedCommentary, tweetCount]
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

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      if (canSubmit && !submitMutation.isPending) submitMutation.mutate()
      return
    }
    if (suggestions.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightIndex((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightIndex((index) => (index - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      const source = activeField === 'tweet' ? tweet : commentary
      const fragment = activeFragment(source, caret)
      if (fragment) setDismissedStart(fragment.start)
    } else if (event.key === 'Tab' || event.key === 'Enter') {
      event.preventDefault()
      const chosen = suggestions[highlightIndex] ?? suggestions[0]
      pickSuggestion(activeField, chosen.label)
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

      const title = publishedTweet || null
      const slugBase = normalizeSlugBase(publishedTweet || 'tweet') || 'tweet'
      const slug = existingPost?.slug ?? `${slugBase}-${Date.now().toString(36)}`
      const creatorIds = isEditMode
        ? existingPost?.creators?.map((creator) => creator.id)
        : [user.id]

      const payload = {
        title,
        description: existingPost?.description ?? undefined,
        slug,
        content: publishedCommentary ? publishedCommentary : null,
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

  const authorName = user?.name ?? 'You'
  const handle = user?.username ?? 'you'
  const slug = normalizeSlugBase(publishedTweet || 'tweet') || 'tweet'

  return (
    <>
      <PostPageHeader
        title={isEditMode ? 'Edit Tweet' : 'Tweet Capture'}
        description={
          isEditMode
            ? 'Update the tweet commentary or replace the attached music.'
            : 'Type a quip, tag with #hashtags, paste a music link, and capture the post fast.'
        }
        isEditMode={isEditMode}
        backLink={
          isEditMode && existingPost ? (
            <Link
              to='/tweet/$slug'
              params={{ slug: existingPost.slug }}
              className='mb-3 inline-flex items-center gap-2 text-base text-muted-foreground hover:text-foreground'>
              <ArrowLeft className='size-4' />
              Back to tweet
            </Link>
          ) : undefined
        }
      />

      <div className='mb-4 flex items-center justify-end gap-4'>
        <span className='text-xs text-muted-foreground'>⌘↵ to save</span>
        <Button
          onClick={() => submitMutation.mutate()}
          disabled={!canSubmit || submitMutation.isPending}
          size='lg'
          className='gap-2 font-semibold'>
          {submitMutation.isPending ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <Send className='size-4' />
          )}
          {submitMutation.isPending ? 'Saving…' : isEditMode ? 'Update tweet' : 'Save tweet'}
        </Button>
      </div>

      <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'>
        <div className='flex flex-col bg-gb-darker-bg'>
          <div className='flex flex-col gap-2 p-6 pb-2'>
            <ComposerField
              id='tweet'
              label={
                <span>
                  Tweet <span className='opacity-70'>· type # to tag</span>
                </span>
              }
              hint={
                <span
                  className='tabular-nums'
                  data-over={tweetCount > TWEET_MAX_LENGTH}
                  data-near={tweetCount > 230 && tweetCount <= TWEET_MAX_LENGTH}>
                  <span
                    className={
                      tweetCount > TWEET_MAX_LENGTH
                        ? 'text-destructive'
                        : tweetCount > 230
                          ? 'text-yellow-500'
                          : ''
                    }>
                    {tweetCount}
                  </span>
                  /{TWEET_MAX_LENGTH}
                </span>
              }
              value={tweet}
              placeholder='A short quip, e.g. “I dig this #ambient”'
              minRows='md'
              fontSize='lg'
              suggestions={activeField === 'tweet' ? suggestions : []}
              highlightIndex={highlightIndex}
              onChange={handleTweetChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setActiveField('tweet')}
              onPickSuggestion={(tag) => pickSuggestion('tweet', tag)}
              onHoverSuggestion={setHighlightIndex}
            />
          </div>

          <div className='px-6 pb-5 pt-2'>
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
          </div>

          <div className='flex flex-col gap-2 border-t border-gb-pastel-green-2/15 p-6 pt-4'>
            <ComposerField
              id='commentary'
              label='Commentary'
              hint={<span className='opacity-75'>markdown · optional</span>}
              value={commentary}
              placeholder='Why this one? Paste a tweet link here to quote it.'
              minRows='sm'
              fontSize='base'
              suggestions={activeField === 'commentary' ? suggestions : []}
              highlightIndex={highlightIndex}
              onChange={handleCommentaryChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setActiveField('commentary')}
              onPickSuggestion={(tag) => pickSuggestion('commentary', tag)}
              onHoverSuggestion={setHighlightIndex}
            />
          </div>

          <div className='px-6 pb-5'>
            <TagRow
              tags={tagChips}
              recentTags={recentTags}
              onRemove={removeTag}
              onAddRecent={addRecentTag}
            />
          </div>

          {quotedSlug ? (
            <div className='border-t border-gb-pastel-green-2/15 p-6 pt-4'>
              <div className='flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground'>
                <MessageSquareQuote className='size-3.5' />
                Quoted tweet
              </div>
              {resolvedQuote.isPending ? (
                <div className='mt-2 flex items-center gap-2 text-xs text-muted-foreground'>
                  <Loader2 className='size-3.5 animate-spin' />
                  Resolving quoted tweet…
                </div>
              ) : resolvedQuote.data?.title || resolvedQuote.data?.content ? (
                <div className='mt-2 flex items-center gap-3 border border-gb-pastel-green-2/15 bg-black/20 p-2.5'>
                  <MessageSquareQuote className='size-4 shrink-0 text-muted-foreground' />
                  <div className='min-w-0 flex-1 truncate text-base text-muted-foreground'>
                    {resolvedQuote.data?.title || resolvedQuote.data?.content}
                  </div>
                </div>
              ) : (
                <p className='mt-2 text-xs text-muted-foreground'>
                  Paste a tweet link in the commentary to auto-attach it as a quote.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <TweetPreview
          slug={slug}
          authorName={authorName}
          handle={handle}
          avatarUrl={user?.image ?? null}
          previewText={publishedTweet || 'Your tweet will appear here.'}
          hasText={Boolean(publishedTweet)}
          commentary={publishedCommentary}
          hasEntity={hasEntity}
          entityTitle={displayedEntityTitle}
          entityMeta={entityMeta}
          coverImageUrl={displayedCoverImageUrl}
          tags={tags}
        />
      </div>
    </>
  )
}
