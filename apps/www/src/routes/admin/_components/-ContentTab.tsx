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

interface PostItem {
  id: string
  title: string
  slug: string
  type: 'post' | 'micro' | null
  createdAt: string
  tags?: string[] | null
  creators?: Array<{ id: string; name: string }>
}

interface EditDialogState {
  open: boolean
  mix: AudioItem | null
  selectedTags: string[]
  inputValue: string
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
      fetcher<PaginatedResponse<PostItem>>(
        `${VPS_BASE_URL}/content/posts?type=post&limit=50&offset=0`
      )
  })
  const { data: tweetData, isPending: tweetPending } = useQuery({
    queryKey: ['admin', 'posts', 'micro'],
    queryFn: () =>
      fetcher<PaginatedResponse<PostItem>>(
        `${VPS_BASE_URL}/content/posts?type=micro&limit=50&offset=0`
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

  const mixes = mixesData?.data ?? []
  const labels = labelsData?.data ?? []
  const editorialPosts = editorialData?.data ?? []
  const tweetPosts = tweetData?.data ?? []

  const sortedMixes = useMemo(() => {
    return [...mixes].sort((left, right) =>
      mixPlaySortOrder === 'asc'
        ? left.playCount - right.playCount
        : right.playCount - left.playCount
    )
  }, [mixPlaySortOrder, mixes])

  const allExistingTags = useMemo(() => {
    const tagSet = new Set<string>()
    mixes.forEach((mix) => {
      mix.tags?.forEach((t) => {
        tagSet.add(t)
      })
    })
    return Array.from(tagSet).sort()
  }, [mixes])

  const filteredTags = useMemo(() => {
    const input = editDialog.inputValue.toLowerCase()
    return allExistingTags.filter(
      (tag) =>
        tag.toLowerCase().includes(input) &&
        !editDialog.selectedTags.includes(tag)
    )
  }, [allExistingTags, editDialog.inputValue, editDialog.selectedTags])

  const showAddNew =
    editDialog.inputValue.trim() &&
    !allExistingTags.includes(editDialog.inputValue.trim().toLowerCase()) &&
    !editDialog.selectedTags.includes(
      editDialog.inputValue.trim().toLowerCase()
    )

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap gap-2'>
        <Button asChild size='sm'>
          <Link to='/post-upload' search={{ type: 'post' }}>
            <Plus className='w-4 h-4 mr-2' />
            New editorial
          </Link>
        </Button>
        <Button asChild size='sm' variant='outline'>
          <Link to='/post-upload' search={{ type: 'micro' }}>
            <Plus className='w-4 h-4 mr-2' />
            New tweet
          </Link>
        </Button>
      </div>
      <Tabs defaultValue='mixes'>
        <TabsList>
          <TabsTrigger value='mixes'>Mixes ({mixes.length})</TabsTrigger>
          <TabsTrigger value='editorial'>
            Editorial ({editorialPosts.length})
          </TabsTrigger>
          <TabsTrigger value='tweet'>Tweet ({tweetPosts.length})</TabsTrigger>
          <TabsTrigger value='labels'>Labels ({labels.length})</TabsTrigger>
        </TabsList>

        <TabsContent value='mixes' className='mt-4'>
          {mixesPending ? (
            <div className='py-8 text-center text-muted-foreground'>
              Loading mixes...
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
                        onClick={() =>
                          setMixPlaySortOrder((current) =>
                            current === 'desc' ? 'asc' : 'desc'
                          )
                        }>
                        Plays {mixPlaySortOrder === 'desc' ? '↓' : '↑'}
                        <ArrowUpDown className='ml-2 h-3.5 w-3.5' />
                      </Button>
                    </th>
                    <th className='px-4 py-3 text-left font-medium'>
                      Created By
                    </th>
                    <th className='px-4 py-3 text-left font-medium'>Created</th>
                    <th className='px-4 py-3 text-left font-medium'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMixes.map((mix) => (
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
                            onClick={() => openEditDialog(mix)}>
                            Edit
                          </Button>
                          <Button variant='outline' size='sm' asChild>
                            <Link
                              to='/mixes/$mixId'
                              params={{ mixId: mix.slug }}>
                              View
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sortedMixes.length === 0 && (
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

        <TabsContent value='editorial' className='mt-4'>
          {editorialPending ? (
            <div className='py-8 text-center text-muted-foreground'>
              Loading editorial posts...
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
                      Created By
                    </th>
                    <th className='px-4 py-3 text-left font-medium'>Created</th>
                    <th className='px-4 py-3 text-left font-medium'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editorialPosts.map((post) => (
                    <tr key={post.id} className='border-b hover:bg-muted/50'>
                      <td className='px-4 py-3'>{post.title}</td>
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
                        <div className='flex gap-2'>
                          <Button variant='outline' size='sm' asChild>
                            <Link
                              to='/editorial/$slug'
                              params={{ slug: post.slug }}>
                              View
                            </Link>
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => {
                              window.location.href = `/post-upload?edit=${encodeURIComponent(post.slug)}&type=post`
                            }}>
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {editorialPosts.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className='px-4 py-8 text-center text-muted-foreground'>
                        No editorial posts found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value='tweet' className='mt-4'>
          {tweetPending ? (
            <div className='py-8 text-center text-muted-foreground'>
              Loading tweet posts...
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
                      Created By
                    </th>
                    <th className='px-4 py-3 text-left font-medium'>Created</th>
                    <th className='px-4 py-3 text-left font-medium'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tweetPosts.map((post) => (
                    <tr key={post.id} className='border-b hover:bg-muted/50'>
                      <td className='px-4 py-3'>{post.title}</td>
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
                        <div className='flex gap-2'>
                          <Button variant='outline' size='sm' asChild>
                            <Link
                              to='/tweet/$slug'
                              params={{ slug: post.slug }}>
                              View
                            </Link>
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => {
                              window.location.href = `/post-upload?edit=${encodeURIComponent(post.slug)}&type=micro`
                            }}>
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tweetPosts.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className='px-4 py-8 text-center text-muted-foreground'>
                        No tweet posts found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value='labels' className='mt-4'>
          {labelsPending ? (
            <div className='py-8 text-center text-muted-foreground'>
              Loading labels...
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
      </Tabs>

      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Edit Tags</DialogTitle>
            <DialogDescription>
              Edit tags for "{editDialog.mix?.title}". Select existing tags or
              add new ones.
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
                        onClick={() => removeTag(tag)}
                        className='ml-1 hover:text-foreground'>
                        <X className='w-3 h-3' />
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
                  placeholder='Search or type new tag...'
                  value={editDialog.inputValue}
                  onValueChange={(value) =>
                    setEditDialog((prev) => ({ ...prev, inputValue: value }))
                  }
                />
                <CommandList>
                  <CommandEmpty>
                    {editDialog.inputValue.trim() ? (
                      <button
                        type='button'
                        className='flex items-center gap-2 px-2 py-1.5 text-sm w-full hover:bg-accent rounded-sm'
                        onClick={() => addTag(editDialog.inputValue)}>
                        <Plus className='w-4 h-4' />
                        Add "{editDialog.inputValue.trim()}"
                      </button>
                    ) : (
                      'Type to search or add new tags'
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {showAddNew && (
                      <CommandItem
                        onSelect={() => addTag(editDialog.inputValue)}
                        className='gap-2'>
                        <Plus className='w-4 h-4' />
                        Add "{editDialog.inputValue.trim()}"
                      </CommandItem>
                    )}
                    {filteredTags.map((tag) => (
                      <CommandItem
                        key={tag}
                        onSelect={() => addTag(tag)}
                        className='gap-2'>
                        <Check className='w-4 h-4 opacity-0' />
                        {tag}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() =>
                setEditDialog({
                  open: false,
                  mix: null,
                  selectedTags: [],
                  inputValue: ''
                })
              }>
              Cancel
            </Button>
            <Button
              onClick={handleEditTags}
              disabled={updateMixMutation.isPending}>
              {updateMixMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
