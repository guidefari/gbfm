import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { fetcher, type PaginatedResponse, VPS_BASE_URL } from '@/lib/http'

interface AudioItem {
  id: string
  title: string
  slug: string
  type: string
  createdAt: string
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

interface PublicationItem {
  id: string
  title: string
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

interface DeleteDialogState {
  open: boolean
  type: 'mix' | 'label' | 'publication'
  id: string
  name: string
}

interface EditDialogState {
  open: boolean
  mix: AudioItem | null
  selectedTags: string[]
  inputValue: string
}

export function ContentTab() {
  const queryClient = useQueryClient()
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    type: 'mix',
    id: '',
    name: ''
  })
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

  const { data: publicationsData, isPending: publicationsPending } = useQuery({
    queryKey: ['admin', 'publications'],
    queryFn: () =>
      fetcher<PaginatedResponse<PublicationItem>>(
        `${VPS_BASE_URL}/publication?limit=50&offset=0`
      )
  })
  const { data: dispatchData, isPending: dispatchPending } = useQuery({
    queryKey: ['admin', 'posts', 'post'],
    queryFn: () =>
      fetcher<PaginatedResponse<PostItem>>(
        `${VPS_BASE_URL}/content/posts?type=post&limit=50&offset=0`
      )
  })
  const { data: pingsData, isPending: pingsPending } = useQuery({
    queryKey: ['admin', 'posts', 'micro'],
    queryFn: () =>
      fetcher<PaginatedResponse<PostItem>>(
        `${VPS_BASE_URL}/content/posts?type=micro&limit=50&offset=0`
      )
  })

  const deletePublicationMutation = useMutation({
    mutationFn: (id: string) =>
      fetcher(`${VPS_BASE_URL}/publication/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'publications'] })
      setDeleteDialog({ open: false, type: 'mix', id: '', name: '' })
      toast({ title: 'Publication deleted successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to delete publication',
        description: err.message,
        variant: 'destructive'
      })
    }
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

  const handleDelete = () => {
    if (deleteDialog.type === 'publication') {
      deletePublicationMutation.mutate(deleteDialog.id)
    }
  }

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
  const publications = publicationsData?.data ?? []
  const dispatchPosts = dispatchData?.data ?? []
  const pingPosts = pingsData?.data ?? []

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
      <Tabs defaultValue='mixes'>
        <TabsList>
          <TabsTrigger value='mixes'>Mixes ({mixes.length})</TabsTrigger>
          <TabsTrigger value='dispatch'>
            Dispatch ({dispatchPosts.length})
          </TabsTrigger>
          <TabsTrigger value='pings'>Pings ({pingPosts.length})</TabsTrigger>
          <TabsTrigger value='labels'>Labels ({labels.length})</TabsTrigger>
          <TabsTrigger value='publications'>
            Publications ({publications.length})
          </TabsTrigger>
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
                      Created By
                    </th>
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
                  {mixes.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
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

        <TabsContent value='dispatch' className='mt-4'>
          {dispatchPending ? (
            <div className='py-8 text-center text-muted-foreground'>
              Loading dispatch posts...
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
                  {dispatchPosts.map((post) => (
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
                              to='/dispatch/$slug'
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
                  {dispatchPosts.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className='px-4 py-8 text-center text-muted-foreground'>
                        No dispatch posts found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value='pings' className='mt-4'>
          {pingsPending ? (
            <div className='py-8 text-center text-muted-foreground'>
              Loading ping posts...
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
                  {pingPosts.map((post) => (
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
                              to='/pings/$slug'
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
                  {pingPosts.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className='px-4 py-8 text-center text-muted-foreground'>
                        No ping posts found
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

        <TabsContent value='publications' className='mt-4'>
          {publicationsPending ? (
            <div className='py-8 text-center text-muted-foreground'>
              Loading publications...
            </div>
          ) : (
            <div className='overflow-x-auto rounded-sm border'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b bg-muted/50'>
                    <th className='px-4 py-3 text-left font-medium'>Title</th>
                    <th className='px-4 py-3 text-left font-medium'>Created</th>
                    <th className='px-4 py-3 text-left font-medium'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {publications.map((pub) => (
                    <tr key={pub.id} className='border-b hover:bg-muted/50'>
                      <td className='px-4 py-3'>{pub.title}</td>
                      <td className='px-4 py-3 text-muted-foreground'>
                        {new Date(pub.createdAt).toLocaleDateString()}
                      </td>
                      <td className='px-4 py-3'>
                        <Button
                          variant='destructive'
                          size='sm'
                          onClick={() =>
                            setDeleteDialog({
                              open: true,
                              type: 'publication',
                              id: pub.id,
                              name: pub.title
                            })
                          }>
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {publications.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className='px-4 py-8 text-center text-muted-foreground'>
                        No publications found
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
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteDialog.type}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.name}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() =>
                setDeleteDialog({ open: false, type: 'mix', id: '', name: '' })
              }>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={handleDelete}
              disabled={deletePublicationMutation.isPending}>
              {deletePublicationMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
