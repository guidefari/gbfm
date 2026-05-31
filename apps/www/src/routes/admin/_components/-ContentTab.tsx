import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast
} from '@gbfm/ui'
import type {
  SelectMdxCompiledEditorialPost,
  SelectMdxCompiledMicroPost
} from '@gbfm/vps/schemas'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUpDown, Check, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { fetcher, type PaginatedResponse, VPS_BASE_URL } from '@/lib/http'

interface AudioItem {
  id: string
  title: string
  slug: string
  type: string
  createdAt: string
  playCount: number
  tags?: string[] | null
  creators?: Array<{ id: string; name: string }>
}

interface LabelItem {
  id: string
  name: string
  slug: string
  description: string | null
  content: string
  thumbnailUrl: string | null
  website: string | null
  bandcamp: string | null
  discogs: string | null
  createdAt: string
}

type EditorialPostItem = Omit<
  SelectMdxCompiledEditorialPost,
  'createdAt' | 'updatedAt' | 'creators'
> & {
  createdAt: string
  creators?: Array<{ id: string; name: string }>
}

type TweetPostItem = Omit<
  SelectMdxCompiledMicroPost,
  'createdAt' | 'updatedAt' | 'creators'
> & {
  createdAt: string
  creators?: Array<{ id: string; name: string }>
}

interface EditDialogState {
  open: boolean
  mix: AudioItem | null
  selectedTags: string[]
  inputValue: string
}

type PostListItem = {
  id: string
  title: string | null
  slug: string
  tags?: string[] | null
  creators?: Array<{ id: string; name: string }>
  createdAt: string
}

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

function MixesTabContent({
  isPending,
  mixes,
  mixPlaySortOrder,
  onToggleSort,
  onOpenEditDialog
}: {
  isPending: boolean
  mixes: AudioItem[]
  mixPlaySortOrder: 'asc' | 'desc'
  onToggleSort: () => void
  onOpenEditDialog: (mix: AudioItem) => void
}) {
  return (
    <TabsContent value='mixes' className='mt-4'>
      {isPending ? (
        <div className='py-8 text-center text-muted-foreground'>
          Loading mixes…
        </div>
      ) : (
        <div className='overflow-x-auto rounded-sm border'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='px-4 py-3 text-left font-medium'>Title</th>
                <th className='px-4 py-3 text-left font-medium'>Slug</th>
                <th className='px-4 py-3 text-left font-medium'>Tags</th>
                <th className='px-4 py-3 text-left font-medium'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='-ml-3 h-auto px-3 py-0 font-medium'
                    onClick={onToggleSort}>
                    Plays {mixPlaySortOrder === 'desc' ? '↓' : '↑'}
                    <ArrowUpDown className='ml-2 size-3.5' />
                  </Button>
                </th>
                <th className='px-4 py-3 text-left font-medium'>Created By</th>
                <th className='px-4 py-3 text-left font-medium'>Created</th>
                <th className='px-4 py-3 text-left font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mixes.map((mix) => (
                <tr key={mix.id} className='border-b hover:bg-muted/50'>
                  <td className='px-4 py-3'>{mix.title}</td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {mix.slug}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {mix.tags?.join(', ') || '—'}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {mix.playCount.toLocaleString()}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {mix.creators?.map((c) => c.name).join(', ') || '—'}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {new Date(mix.createdAt).toLocaleDateString()}
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => onOpenEditDialog(mix)}>
                        Edit
                      </Button>
                      <Button variant='outline' size='sm' asChild>
                        <Link to='/mixes/$mixId' params={{ mixId: mix.slug }}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {mixes.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className='px-4 py-8 text-center text-muted-foreground'>
                    No mixes found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </TabsContent>
  )
}

function PostsTabContent({
  value,
  isPending,
  items,
  emptyLabel,
  actionKind,
  titleFallback
}: {
  value: 'editorial' | 'tweet'
  isPending: boolean
  items: PostListItem[]
  emptyLabel: string
  actionKind: 'editorial' | 'tweet'
  titleFallback?: string
}) {
  return (
    <TabsContent value={value} className='mt-4'>
      {isPending ? (
        <div className='py-8 text-center text-muted-foreground'>
          Loading {emptyLabel.toLowerCase()}…
        </div>
      ) : (
        <div className='overflow-x-auto rounded-sm border'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='px-4 py-3 text-left font-medium'>Title</th>
                <th className='px-4 py-3 text-left font-medium'>Slug</th>
                <th className='px-4 py-3 text-left font-medium'>Tags</th>
                <th className='px-4 py-3 text-left font-medium'>Created By</th>
                <th className='px-4 py-3 text-left font-medium'>Created</th>
                <th className='px-4 py-3 text-left font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((post) => (
                <tr key={post.id} className='border-b hover:bg-muted/50'>
                  <td className='px-4 py-3'>{post.title || titleFallback}</td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {post.slug}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {post.tags?.join(', ') || '—'}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {post.creators?.map((c) => c.name).join(', ') || '—'}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </td>
                  <td className='px-4 py-3'>
                    {actionKind === 'editorial' ? (
                      <EditorialPostActions post={post} />
                    ) : (
                      <TweetPostActions post={post} />
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className='px-4 py-8 text-center text-muted-foreground'>
                    No {emptyLabel.toLowerCase()} found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </TabsContent>
  )
}

function EditorialPostActions({ post }: { post: PostListItem }) {
  return (
    <div className='flex gap-2'>
      <Button variant='outline' size='sm' asChild>
        <Link to='/editorial/$slug' params={{ slug: post.slug }}>
          View
        </Link>
      </Button>
      <Button variant='outline' size='sm' asChild>
        <Link to='/new/editorial' search={{ edit: post.slug }}>
          Edit
        </Link>
      </Button>
    </div>
  )
}

function TweetPostActions({ post }: { post: PostListItem }) {
  return (
    <div className='flex gap-2'>
      <Button variant='outline' size='sm' asChild>
        <Link to='/tweet/$slug' params={{ slug: post.slug }}>
          View
        </Link>
      </Button>
      <Button variant='outline' size='sm' asChild>
        <Link to='/new/tweet' search={{ edit: post.slug }}>
          Edit
        </Link>
      </Button>
    </div>
  )
}

function LabelsTabContent({
  isPending,
  labels
}: {
  isPending: boolean
  labels: LabelItem[]
}) {
  return (
    <TabsContent value='labels' className='mt-4'>
      {isPending ? (
        <div className='py-8 text-center text-muted-foreground'>
          Loading labels…
        </div>
      ) : (
        <div className='overflow-x-auto rounded-sm border'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='px-4 py-3 text-left font-medium'>Name</th>
                <th className='px-4 py-3 text-left font-medium'>Slug</th>
                <th className='px-4 py-3 text-left font-medium'>Created</th>
                <th className='px-4 py-3 text-left font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {labels.map((label) => (
                <tr key={label.id} className='border-b hover:bg-muted/50'>
                  <td className='px-4 py-3'>{label.name}</td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {label.slug}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {new Date(label.createdAt).toLocaleDateString()}
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex gap-2'>
                      <Button variant='outline' size='sm' asChild>
                        <Link
                          to='/labels/$labelSlug'
                          params={{ labelSlug: label.slug }}>
                          View
                        </Link>
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          window.location.href = `/label-upload?edit=${encodeURIComponent(label.slug)}&title=${encodeURIComponent(label.name || '')}&description=${encodeURIComponent(label.description || '')}&content=${encodeURIComponent(label.content || '')}&thumbnailUrl=${encodeURIComponent(label.thumbnailUrl || '')}`
                        }}>
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {labels.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className='px-4 py-8 text-center text-muted-foreground'>
                    No labels found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </TabsContent>
  )
}

function EditTagsDialog({
  editDialog,
  filteredTags,
  showAddNew,
  isPending,
  onOpenChange,
  onInputValueChange,
  onAddTag,
  onRemoveTag,
  onCancel,
  onSave
}: {
  editDialog: EditDialogState
  filteredTags: string[]
  showAddNew: string | false
  isPending: boolean
  onOpenChange: (open: boolean) => void
  onInputValueChange: (value: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={editDialog.open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Edit Tags</DialogTitle>
          <DialogDescription>
            Edit tags for "{editDialog.mix?.title}". Select existing tags or add
            new ones.
          </DialogDescription>
        </DialogHeader>
        <div className='py-4 space-y-4'>
          <div>
            <Label>Selected Tags</Label>
            <div className='flex flex-wrap gap-2 mt-2 min-h-[32px]'>
              {editDialog.selectedTags.length === 0 ? (
                <span className='text-sm text-muted-foreground'>
                  No tags selected
                </span>
              ) : (
                editDialog.selectedTags.map((tag) => (
                  <Badge key={tag} variant='secondary' className='gap-1'>
                    {tag}
                    <button
                      type='button'
                      onClick={() => onRemoveTag(tag)}
                      className='ml-1 hover:text-foreground'>
                      <X className='size-3' />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div>
            <Label>Add Tags</Label>
            <Command className='mt-2 border rounded-sm'>
              <CommandInput
                placeholder='Search or type new tag…'
                value={editDialog.inputValue}
                onValueChange={onInputValueChange}
              />
              <CommandList>
                <CommandEmpty>
                  {editDialog.inputValue.trim() ? (
                    <button
                      type='button'
                      className='flex items-center gap-2 px-2 py-1.5 text-sm w-full hover:bg-accent rounded-sm'
                      onClick={() => onAddTag(editDialog.inputValue)}>
                      <Plus className='size-4' />
                      Add "{editDialog.inputValue.trim()}"
                    </button>
                  ) : (
                    'Type to search or add new tags'
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {showAddNew && (
                    <CommandItem
                      onSelect={() => onAddTag(editDialog.inputValue)}
                      className='gap-2'>
                      <Plus className='size-4' />
                      Add "{editDialog.inputValue.trim()}"
                    </CommandItem>
                  )}
                  {filteredTags.map((tag) => (
                    <CommandItem
                      key={tag}
                      onSelect={() => onAddTag(tag)}
                      className='gap-2'>
                      <Check className='size-4 opacity-0' />
                      {tag}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ContentTab() {
  const queryClient = useQueryClient()
  const [mixPlaySortOrder, setMixPlaySortOrder] = useState<'asc' | 'desc'>(
    'desc'
  )
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    mix: null,
    selectedTags: [],
    inputValue: ''
  })

  const { data: mixesData, isPending: mixesPending } = useQuery({
    queryKey: ['admin', 'mixes'],
    queryFn: () =>
      fetcher<PaginatedResponse<AudioItem>>(
        `${VPS_BASE_URL}/content/audio/mix?limit=50&offset=0`
      )
  })

  const { data: labelsData, isPending: labelsPending } = useQuery({
    queryKey: ['admin', 'labels'],
    queryFn: () =>
      fetcher<PaginatedResponse<LabelItem>>(
        `${VPS_BASE_URL}/content/labels?limit=50&offset=0`
      )
  })

  const { data: editorialData, isPending: editorialPending } = useQuery({
    queryKey: ['admin', 'posts', 'post'],
    queryFn: () =>
      fetcher<PaginatedResponse<EditorialPostItem>>(
        `${VPS_BASE_URL}/content/posts/editorials?limit=50&offset=0`
      )
  })
  const { data: tweetData, isPending: tweetPending } = useQuery({
    queryKey: ['admin', 'posts', 'micro'],
    queryFn: () =>
      fetcher<PaginatedResponse<TweetPostItem>>(
        `${VPS_BASE_URL}/content/posts/micro?limit=50&offset=0`
      )
  })

  const updateMixMutation = useMutation({
    mutationFn: ({ slug, tags }: { slug: string; tags: string[] }) =>
      fetcher(`${VPS_BASE_URL}/content/audio/mix/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify({ tags })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'mixes'] })
      queryClient.invalidateQueries({ queryKey: ['audio', 'mix'] })
      setEditDialog({
        open: false,
        mix: null,
        selectedTags: [],
        inputValue: ''
      })
      toast({ title: 'Tags updated successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to update tags',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const handleEditTags = () => {
    if (!editDialog.mix) return
    updateMixMutation.mutate({
      slug: editDialog.mix.slug,
      tags: editDialog.selectedTags
    })
  }

  const openEditDialog = (mix: AudioItem) => {
    setEditDialog({
      open: true,
      mix,
      selectedTags: mix.tags || [],
      inputValue: ''
    })
  }

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase()
    if (trimmedTag && !editDialog.selectedTags.includes(trimmedTag)) {
      setEditDialog((prev) => ({
        ...prev,
        selectedTags: [...prev.selectedTags, trimmedTag],
        inputValue: ''
      }))
    }
  }

  const removeTag = (tag: string) => {
    setEditDialog((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.filter((t) => t !== tag)
    }))
  }

  const mixes = mixesData?.data
  const labels = labelsData?.data
  const editorialPosts = editorialData?.data
  const tweetPosts = tweetData?.data

  const sortedMixes = useMemo(() => {
    return (mixes ?? []).toSorted((left, right) =>
      mixPlaySortOrder === 'asc'
        ? left.playCount - right.playCount
        : right.playCount - left.playCount
    )
  }, [mixPlaySortOrder, mixes])

  const allExistingTags = useMemo(() => {
    const tagSet = new Set<string>()
    ;(mixes ?? []).forEach((mix) => {
      mix.tags?.forEach((t) => {
        tagSet.add(t)
      })
    })
    return Array.from(tagSet).toSorted()
  }, [mixes])

  const filteredTags = useMemo(() => {
    const input = editDialog.inputValue.toLowerCase()
    return allExistingTags.filter(
      (tag) =>
        tag.toLowerCase().includes(input) &&
        !editDialog.selectedTags.includes(tag)
    )
  }, [allExistingTags, editDialog.inputValue, editDialog.selectedTags])

  const normalizedInputValue = editDialog.inputValue.trim().toLowerCase()
  const showAddNew: string | false =
    normalizedInputValue.length > 0 &&
    !allExistingTags.includes(normalizedInputValue) &&
    !editDialog.selectedTags.includes(normalizedInputValue)
      ? normalizedInputValue
      : false

  return (
    <div className='space-y-4'>
      <NewContentButtons />
      <Tabs defaultValue='mixes'>
        <TabsList>
          <TabsTrigger value='mixes'>Mixes ({mixes?.length ?? 0})</TabsTrigger>
          <TabsTrigger value='editorial'>
            Editorial ({editorialPosts?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value='tweet'>
            Tweet ({tweetPosts?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value='labels'>
            Labels ({labels?.length ?? 0})
          </TabsTrigger>
        </TabsList>
        <MixesTabContent
          isPending={mixesPending}
          mixes={sortedMixes}
          mixPlaySortOrder={mixPlaySortOrder}
          onToggleSort={() =>
            setMixPlaySortOrder((current) =>
              current === 'desc' ? 'asc' : 'desc'
            )
          }
          onOpenEditDialog={openEditDialog}
        />
        <PostsTabContent
          value='editorial'
          isPending={editorialPending}
          items={editorialPosts ?? []}
          emptyLabel='Editorial posts'
          actionKind='editorial'
        />
        <PostsTabContent
          value='tweet'
          isPending={tweetPending}
          items={tweetPosts ?? []}
          emptyLabel='Tweet posts'
          actionKind='tweet'
          titleFallback='Tweet'
        />
        <LabelsTabContent isPending={labelsPending} labels={labels ?? []} />
      </Tabs>
      <EditTagsDialog
        editDialog={editDialog}
        filteredTags={filteredTags}
        showAddNew={showAddNew}
        isPending={updateMixMutation.isPending}
        onOpenChange={(open) => setEditDialog((prev) => ({ ...prev, open }))}
        onInputValueChange={(value) =>
          setEditDialog((prev) => ({ ...prev, inputValue: value }))
        }
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onCancel={() =>
          setEditDialog({
            open: false,
            mix: null,
            selectedTags: [],
            inputValue: ''
          })
        }
        onSave={handleEditTags}
      />
    </div>
  )
}
