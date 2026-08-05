import { Button, Tabs, TabsList, TabsTrigger, toast } from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { apiUrl, fetcher, type PaginatedResponse } from '@/lib/http'
import { BulkActionBar } from './BulkActionBar'
import { MetadataDrawer } from './MetadataDrawer'
import { MixesTable } from './MixesTable'
import { PostsTable } from './PostsTable'
import {
  type AudioEditValues,
  type AudioItem,
  type ContentScope,
  type ContentView,
  defaultContentView,
  type EditDialogState,
  type EditorialPostItem,
  emptyAudioEditValues,
  emptyPostEditValues,
  isContentTab,
  PAGE_SIZE,
  type PostEditDialogState,
  type PostEditValues,
  type PostListItem,
  toAudioEditValues,
  toPostEditValues,
  type TweetPostItem
} from './types'

function NewContentButtons() {
  return (
    <div className='flex flex-wrap gap-2'>
      <Button asChild size='sm'>
        <Link to='/new/editorial' search={{ edit: undefined }}>
          <Plus className='mr-2 size-4' />
          New editorial
        </Link>
      </Button>
      <Button asChild size='sm' variant='outline'>
        <Link to='/new/tweet' search={{ edit: undefined }}>
          <Plus className='mr-2 size-4' />
          New tweet
        </Link>
      </Button>
    </div>
  )
}

export function ContentManager({
  scope = 'all',
  view,
  onViewChange
}: {
  scope?: ContentScope
  view?: ContentView
  onViewChange?: (view: ContentView) => void
}) {
  const queryClient = useQueryClient()
  const [localView, setLocalView] = useState<ContentView>(defaultContentView)
  const activeView = view ?? localView
  const setView = (next: ContentView) => {
    setLocalView(next)
    onViewChange?.(next)
  }
  const { tab, offset, sort, order } = activeView
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null)
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    mix: null,
    values: emptyAudioEditValues
  })
  const [postEditDialog, setPostEditDialog] = useState<PostEditDialogState>({
    open: false,
    post: null,
    values: emptyPostEditValues,
    type: 'post'
  })

  const { data: mixesData, isPending: mixesPending } = useQuery({
    queryKey: ['admin', 'mixes', offset, sort, order],
    queryFn: () =>
      fetcher<PaginatedResponse<AudioItem>>(
        apiUrl(
          `/content/audio/mix/manage?limit=${PAGE_SIZE}&offset=${offset}&sort=${sort}&order=${order}`
        )
      ),
    placeholderData: (previous) => previous
  })

  const { data: editorialData, isPending: editorialPending } = useQuery({
    queryKey: ['admin', 'posts', 'post', offset],
    queryFn: () =>
      fetcher<PaginatedResponse<EditorialPostItem>>(
        apiUrl(`/content/posts/manage?type=post&limit=${PAGE_SIZE}&offset=${offset}`)
      ),
    placeholderData: (previous) => previous
  })
  const { data: tweetData, isPending: tweetPending } = useQuery({
    queryKey: ['admin', 'posts', 'micro', offset],
    queryFn: () =>
      fetcher<PaginatedResponse<TweetPostItem>>(
        apiUrl(`/content/posts/manage?type=micro&limit=${PAGE_SIZE}&offset=${offset}`)
      ),
    placeholderData: (previous) => previous
  })

  const invalidatePostQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'posts', 'post'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'posts', 'micro'] })
    queryClient.invalidateQueries({ queryKey: ['posts', 'editorials'] })
  }

  const updateMixMutation = useMutation({
    mutationFn: ({ slug, values }: { slug: string; values: AudioEditValues }) =>
      fetcher(apiUrl(`/content/audio/mix/${slug}`), {
        method: 'PATCH',
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          slug: values.slug,
          content: values.content,
          thumbnailUrl: values.thumbnailUrl,
          url: values.url,
          tags: values.tags,
          draft: values.draft,
          ...(values.episodeNumber ? { episodeNumber: Number(values.episodeNumber) } : {})
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'mixes'] })
      queryClient.invalidateQueries({ queryKey: ['audio', 'mix'] })
      setEditDialog({
        open: false,
        mix: null,
        values: emptyAudioEditValues
      })
      toast({ title: 'Mix updated successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to update mix',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const updatePostMutation = useMutation({
    mutationFn: ({
      slug,
      values,
      type
    }: {
      slug: string
      values: PostEditValues
      type: 'post' | 'micro'
    }) =>
      fetcher(apiUrl(`/content/posts/${slug}`), {
        method: 'PATCH',
        body: JSON.stringify({
          title: values.title.trim() || null,
          description: values.description,
          slug: values.slug,
          content: values.content.trim() ? values.content : null,
          thumbnailUrl: values.thumbnailUrl || null,
          tags: values.tags,
          draft: values.draft,
          type
        })
      }),
    onSuccess: () => {
      invalidatePostQueries()
      setPostEditDialog({
        open: false,
        post: null,
        values: emptyPostEditValues,
        type: 'post'
      })
      toast({ title: 'Post updated successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to update post',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const setDraftMutation = useMutation({
    mutationFn: ({ slug, draft }: { slug: string; draft: boolean }) =>
      fetcher(apiUrl(`/content/posts/${slug}`), {
        method: 'PATCH',
        body: JSON.stringify({ draft })
      })
  })

  const mixes = mixesData?.data
  const editorialPosts = editorialData?.data
  const tweetPosts = tweetData?.data

  const postsById = useMemo(() => {
    const map = new Map<string, PostListItem>()
    for (const post of [...(editorialPosts ?? []), ...(tweetPosts ?? [])]) {
      map.set(post.id, post)
    }
    return map
  }, [editorialPosts, tweetPosts])

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      const next = new Set(prev)
      for (const id of ids) {
        if (allSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const toggleDraft = async (post: PostListItem) => {
    setTogglingSlug(post.slug)
    try {
      await setDraftMutation.mutateAsync({ slug: post.slug, draft: !post.draft })
      invalidatePostQueries()
      toast({ title: post.draft ? 'Published' : 'Moved to draft' })
    } catch (error) {
      toast({
        title: 'Failed to update status',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive'
      })
    } finally {
      setTogglingSlug(null)
    }
  }

  const applyBulkDraft = async (draft: boolean) => {
    const targets = [...selectedIds]
      .map((id) => postsById.get(id))
      .filter((post): post is PostListItem => Boolean(post) && post?.draft !== draft)

    if (targets.length === 0) {
      setSelectedIds(new Set())
      return
    }

    const results = await Promise.allSettled(
      targets.map((post) => setDraftMutation.mutateAsync({ slug: post.slug, draft }))
    )
    const failed = results.filter((result) => result.status === 'rejected').length
    const succeeded = results.length - failed

    invalidatePostQueries()
    setSelectedIds(new Set())

    if (failed > 0) {
      toast({
        title: `${succeeded} updated, ${failed} failed`,
        variant: 'destructive'
      })
    } else {
      toast({ title: draft ? `${succeeded} moved to draft` : `${succeeded} published` })
    }
  }

  const openEditDialog = (mix: AudioItem) => {
    setEditDialog({
      open: true,
      mix,
      values: toAudioEditValues(mix)
    })
    setPostEditDialog((prev) => ({ ...prev, open: false }))
  }

  const openPostEditDialog = (post: PostListItem, type: 'post' | 'micro') => {
    setPostEditDialog({
      open: true,
      post,
      values: toPostEditValues(post),
      type
    })
    setEditDialog((prev) => ({ ...prev, open: false }))
  }

  const updateAudioValue = (field: keyof AudioEditValues, value: string | boolean) => {
    setEditDialog((prev) => ({
      ...prev,
      values: { ...prev.values, [field]: value }
    }))
  }

  const updatePostValue = (field: keyof PostEditValues, value: string | boolean) => {
    setPostEditDialog((prev) => ({
      ...prev,
      values: { ...prev.values, [field]: value }
    }))
  }

  const addAudioTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase()
    if (trimmedTag && !editDialog.values.tags.includes(trimmedTag)) {
      setEditDialog((prev) => ({
        ...prev,
        values: { ...prev.values, tags: [...prev.values.tags, trimmedTag] }
      }))
    }
  }

  const removeAudioTag = (tag: string) => {
    setEditDialog((prev) => ({
      ...prev,
      values: { ...prev.values, tags: prev.values.tags.filter((t) => t !== tag) }
    }))
  }

  const addPostTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase()
    if (trimmedTag && !postEditDialog.values.tags.includes(trimmedTag)) {
      setPostEditDialog((prev) => ({
        ...prev,
        values: { ...prev.values, tags: [...prev.values.tags, trimmedTag] }
      }))
    }
  }

  const removePostTag = (tag: string) => {
    setPostEditDialog((prev) => ({
      ...prev,
      values: { ...prev.values, tags: prev.values.tags.filter((t) => t !== tag) }
    }))
  }

  const handleSaveAudio = () => {
    if (!editDialog.mix) return
    updateMixMutation.mutate({ slug: editDialog.mix.slug, values: editDialog.values })
  }

  const handleSavePost = () => {
    if (!postEditDialog.post) return
    updatePostMutation.mutate({
      slug: postEditDialog.post.slug,
      values: postEditDialog.values,
      type: postEditDialog.type
    })
  }

  return (
    <div className='space-y-4'>
      <NewContentButtons />
      <BulkActionBar
        selectedCount={selectedIds.size}
        isPending={setDraftMutation.isPending}
        onPublish={() => applyBulkDraft(false)}
        onUnpublish={() => applyBulkDraft(true)}
        onClear={() => setSelectedIds(new Set())}
      />
      <Tabs
        value={tab}
        onValueChange={(next) => {
          if (isContentTab(next)) setView({ ...activeView, tab: next, offset: 0 })
        }}>
        <TabsList>
          <TabsTrigger value='mixes'>Mixes ({mixesData?.pagination.total ?? 0})</TabsTrigger>
          <TabsTrigger value='editorial'>
            Editorial ({editorialData?.pagination.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value='tweet'>Tweet ({tweetData?.pagination.total ?? 0})</TabsTrigger>
        </TabsList>
        <MixesTable
          isPending={mixesPending}
          mixes={mixes ?? []}
          sort={sort}
          order={order}
          scope={scope}
          onToggleSort={() =>
            setView({
              ...activeView,
              sort: 'plays',
              order: sort === 'plays' && order === 'desc' ? 'asc' : 'desc',
              offset: 0
            })
          }
          onOpenEditDialog={openEditDialog}
          pagination={mixesData?.pagination}
          offset={offset}
          onOffsetChange={(next) => setView({ ...activeView, offset: next })}
        />
        <PostsTable
          value='editorial'
          isPending={editorialPending}
          items={editorialPosts ?? []}
          emptyLabel='Editorial posts'
          actionKind='editorial'
          scope={scope}
          selectedIds={selectedIds}
          togglingSlug={togglingSlug}
          onToggleSelected={toggleSelected}
          onToggleAll={toggleAll}
          onToggleDraft={toggleDraft}
          onOpenEditDialog={openPostEditDialog}
          pagination={editorialData?.pagination}
          offset={offset}
          onOffsetChange={(next) => setView({ ...activeView, offset: next })}
        />
        <PostsTable
          value='tweet'
          isPending={tweetPending}
          items={tweetPosts ?? []}
          emptyLabel='Tweet posts'
          actionKind='tweet'
          titleFallback='Tweet'
          scope={scope}
          selectedIds={selectedIds}
          togglingSlug={togglingSlug}
          onToggleSelected={toggleSelected}
          onToggleAll={toggleAll}
          onToggleDraft={toggleDraft}
          onOpenEditDialog={openPostEditDialog}
          pagination={tweetData?.pagination}
          offset={offset}
          onOffsetChange={(next) => setView({ ...activeView, offset: next })}
        />
      </Tabs>
      <MetadataDrawer
        audioState={editDialog}
        postState={postEditDialog}
        isPending={updateMixMutation.isPending || updatePostMutation.isPending}
        onAudioOpenChange={(open) => setEditDialog((prev) => ({ ...prev, open }))}
        onPostOpenChange={(open) => setPostEditDialog((prev) => ({ ...prev, open }))}
        onAudioChange={updateAudioValue}
        onPostChange={updatePostValue}
        onAudioTagAdd={addAudioTag}
        onAudioTagRemove={removeAudioTag}
        onPostTagAdd={addPostTag}
        onPostTagRemove={removePostTag}
        onSaveAudio={handleSaveAudio}
        onSavePost={handleSavePost}
      />
    </div>
  )
}
