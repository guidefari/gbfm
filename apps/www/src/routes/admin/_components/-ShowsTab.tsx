import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  toast
} from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, ExternalLink, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { fetcher, type PaginatedResponse, VPS_BASE_URL } from '@/lib/http'
import { ImageUploadField } from './-ImageUploadField'
import { UserSearch } from './-UserSearch'

interface ShowItem {
  id: string
  title: string
  slug: string
  description: string | null
  content: string
  thumbnailUrl: string | null
  bannerImageUrl: string | null
  draft: boolean
  tags: string[] | null
  createdAt: string
  hosts?: Array<{ id: string; name: string }>
}

interface DeleteDialogState {
  open: boolean
  slug: string
  title: string
}

interface SelectedHost {
  id: string
  name: string
}

interface ShowFormState {
  title: string
  slug: string
  description: string
  content: string
  thumbnailUrl: string
  bannerImageUrl: string
  draft: boolean
  tags: string
  hosts: SelectedHost[]
}

const initialFormState: ShowFormState = {
  title: '',
  slug: '',
  description: '',
  content: '',
  thumbnailUrl: '',
  bannerImageUrl: '',
  draft: false,
  tags: '',
  hosts: []
}

export function ShowsTab() {
  const queryClient = useQueryClient()
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    slug: '',
    title: ''
  })
  const [createDialog, setCreateDialog] = useState(false)
  const [editDialog, setEditDialog] = useState(false)
  const [formData, setFormData] = useState<ShowFormState>(initialFormState)
  const [editingSlug, setEditingSlug] = useState<string>('')

  const { data: showsData, isPending: showsPending } = useQuery({
    queryKey: ['admin', 'shows'],
    queryFn: () =>
      fetcher<PaginatedResponse<ShowItem>>(
        `${VPS_BASE_URL}/shows?limit=50&offset=0`
      )
  })

  const createShowMutation = useMutation({
    mutationFn: (data: ShowFormState) =>
      fetcher(`${VPS_BASE_URL}/shows`, {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          slug: data.slug,
          description: data.description || undefined,
          thumbnailUrl: data.thumbnailUrl || undefined,
          bannerImageUrl: data.bannerImageUrl || undefined,
          draft: data.draft,
          tags: data.tags
            ? data.tags.split(',').map((t) => t.trim())
            : undefined,
          content: data.content || '',
          hostIds:
            data.hosts.length > 0 ? data.hosts.map((h) => h.id) : undefined
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shows'] })
      setCreateDialog(false)
      setFormData(initialFormState)
      toast({ title: 'Show created successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to create show',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const updateShowMutation = useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: ShowFormState }) =>
      fetcher(`${VPS_BASE_URL}/shows/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: data.title,
          slug: data.slug,
          description: data.description || undefined,
          thumbnailUrl: data.thumbnailUrl || undefined,
          bannerImageUrl: data.bannerImageUrl || undefined,
          draft: data.draft,
          tags: data.tags
            ? data.tags.split(',').map((t) => t.trim())
            : undefined,
          content: data.content,
          hostIds: data.hosts.map((h) => h.id)
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shows'] })
      setEditDialog(false)
      setFormData(initialFormState)
      setEditingSlug('')
      toast({ title: 'Show updated successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to update show',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const deleteShowMutation = useMutation({
    mutationFn: (slug: string) =>
      fetcher(`${VPS_BASE_URL}/shows/${slug}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shows'] })
      setDeleteDialog({ open: false, slug: '', title: '' })
      toast({ title: 'Show deleted successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to delete show',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const handleEditClick = (show: ShowItem) => {
    setEditingSlug(show.slug)
    setFormData({
      title: show.title,
      slug: show.slug,
      description: show.description || '',
      content: show.content,
      thumbnailUrl: show.thumbnailUrl || '',
      bannerImageUrl: show.bannerImageUrl || '',
      draft: show.draft,
      tags: show.tags ? show.tags.join(', ') : '',
      hosts: show.hosts || []
    })
    setEditDialog(true)
  }

  const handleDeleteClick = (show: ShowItem) => {
    setDeleteDialog({
      open: true,
      slug: show.slug,
      title: show.title
    })
  }

  const shows = showsData?.data ?? []

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-end'>
        <Button onClick={() => setCreateDialog(true)}>
          <Plus className='w-4 h-4 mr-2' />
          Create Show
        </Button>
      </div>

      {showsPending ? (
        <div className='py-8 text-center text-muted-foreground'>
          Loading shows...
        </div>
      ) : (
        <div className='overflow-x-auto rounded-sm border'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='px-4 py-3 text-left font-medium'>Title</th>
                <th className='px-4 py-3 text-left font-medium'>Slug</th>
                <th className='px-4 py-3 text-left font-medium'>Status</th>
                <th className='px-4 py-3 text-left font-medium'>Hosts</th>
                <th className='px-4 py-3 text-left font-medium'>Created</th>
                <th className='px-4 py-3 text-left font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shows.map((show) => (
                <tr key={show.id} className='border-b hover:bg-muted/50'>
                  <td className='px-4 py-3 font-medium'>{show.title}</td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {show.slug}
                  </td>
                  <td className='px-4 py-3'>
                    {show.draft ? (
                      <Badge variant='secondary'>Draft</Badge>
                    ) : (
                      <Badge variant='outline'>Published</Badge>
                    )}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {show.hosts?.map((h) => h.name).join(', ') || '—'}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {new Date(show.createdAt).toLocaleDateString()}
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex gap-2'>
                      <Button variant='outline' size='sm' asChild>
                        <a
                          href={`/${show.slug}`}
                          target='_blank'
                          rel='noopener noreferrer'>
                          <ExternalLink className='w-4 h-4' />
                          <span className='sr-only'>View Show</span>
                        </a>
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleEditClick(show)}>
                        <Edit className='w-4 h-4' />
                        <span className='sr-only'>Edit</span>
                      </Button>
                      <Button
                        variant='destructive'
                        size='sm'
                        onClick={() => handleDeleteClick(show)}>
                        <Trash className='w-4 h-4' />
                        <span className='sr-only'>Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {shows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className='px-4 py-8 text-center text-muted-foreground'>
                    No shows found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Create New Show</DialogTitle>
            <DialogDescription>
              Add a new show to the schedule.
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='create-title'>Title</Label>
                <Input
                  id='create-title'
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder='Show Title'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='create-slug'>Slug</Label>
                <Input
                  id='create-slug'
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  placeholder='show-slug'
                />
              </div>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='create-description'>Description</Label>
              <Textarea
                id='create-description'
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder='Brief description of the show...'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='create-content'>Content (MDX)</Label>
              <Textarea
                id='create-content'
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder='# Show Content'
                className='font-mono min-h-[150px]'
              />
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <ImageUploadField
                label='Thumbnail (Square)'
                value={formData.thumbnailUrl}
                onChange={(url) =>
                  setFormData({ ...formData, thumbnailUrl: url })
                }
              />
              <ImageUploadField
                label='Banner (Landscape)'
                value={formData.bannerImageUrl}
                onChange={(url) =>
                  setFormData({ ...formData, bannerImageUrl: url })
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='create-tags'>Tags (comma separated)</Label>
              <Input
                id='create-tags'
                value={formData.tags}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
                placeholder='techno, house, ambient'
              />
            </div>
            <UserSearch
              selectedUsers={formData.hosts}
              onSelectionChange={(hosts) => setFormData({ ...formData, hosts })}
            />
            <div className='flex items-center space-x-2'>
              <input
                type='checkbox'
                id='create-draft'
                checked={formData.draft}
                onChange={(e) =>
                  setFormData({ ...formData, draft: e.target.checked })
                }
                className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary'
              />
              <Label htmlFor='create-draft'>Save as Draft</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setCreateDialog(false)
                setFormData(initialFormState)
              }}>
              Cancel
            </Button>
            <Button
              onClick={() => createShowMutation.mutate(formData)}
              disabled={
                createShowMutation.isPending ||
                !formData.title ||
                !formData.slug
              }>
              {createShowMutation.isPending ? 'Creating...' : 'Create Show'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Edit Show</DialogTitle>
            <DialogDescription>
              Update details for "{formData.title}".
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='edit-title'>Title</Label>
                <Input
                  id='edit-title'
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='edit-slug'>Slug</Label>
                <Input
                  id='edit-slug'
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                />
              </div>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-description'>Description</Label>
              <Textarea
                id='edit-description'
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-content'>Content (MDX)</Label>
              <Textarea
                id='edit-content'
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                className='font-mono min-h-[150px]'
              />
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <ImageUploadField
                label='Thumbnail (Square)'
                value={formData.thumbnailUrl}
                onChange={(url) =>
                  setFormData({ ...formData, thumbnailUrl: url })
                }
              />
              <ImageUploadField
                label='Banner (Landscape)'
                value={formData.bannerImageUrl}
                onChange={(url) =>
                  setFormData({ ...formData, bannerImageUrl: url })
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-tags'>Tags (comma separated)</Label>
              <Input
                id='edit-tags'
                value={formData.tags}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
              />
            </div>
            <UserSearch
              selectedUsers={formData.hosts}
              onSelectionChange={(hosts) => setFormData({ ...formData, hosts })}
            />
            <div className='flex items-center space-x-2'>
              <input
                type='checkbox'
                id='edit-draft'
                checked={formData.draft}
                onChange={(e) =>
                  setFormData({ ...formData, draft: e.target.checked })
                }
                className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary'
              />
              <Label htmlFor='edit-draft'>Save as Draft</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setEditDialog(false)
                setFormData(initialFormState)
              }}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                updateShowMutation.mutate({ slug: editingSlug, data: formData })
              }
              disabled={updateShowMutation.isPending || !formData.title}>
              {updateShowMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Show</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.title}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() =>
                setDeleteDialog({ open: false, slug: '', title: '' })
              }>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => deleteShowMutation.mutate(deleteDialog.slug)}
              disabled={deleteShowMutation.isPending}>
              {deleteShowMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
