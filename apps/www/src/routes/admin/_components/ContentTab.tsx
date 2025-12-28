import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { fetcher, type PaginatedResponse, VPS_BASE_URL } from '@/lib/http'

interface AudioItem {
  id: string
  title: string
  slug: string
  type: string
  createdAt: string
  creators?: Array<{ id: string; name: string }>
}

interface LabelItem {
  id: string
  name: string
  slug: string
  createdAt: string
}

interface PublicationItem {
  id: string
  title: string
  createdAt: string
}

interface DeleteDialogState {
  open: boolean
  type: 'mix' | 'label' | 'publication'
  id: string
  name: string
}

export function ContentTab() {
  const queryClient = useQueryClient()
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    type: 'mix',
    id: '',
    name: ''
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

  const handleDelete = () => {
    if (deleteDialog.type === 'publication') {
      deletePublicationMutation.mutate(deleteDialog.id)
    }
  }

  const mixes = mixesData?.data ?? []
  const labels = labelsData?.data ?? []
  const publications = publicationsData?.data ?? []

  return (
    <div className='space-y-4'>
      <Tabs defaultValue='mixes'>
        <TabsList>
          <TabsTrigger value='mixes'>Mixes ({mixes.length})</TabsTrigger>
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
                        {mix.creators?.map((c) => c.name).join(', ') || '—'}
                      </td>
                      <td className='px-4 py-3 text-muted-foreground'>
                        {new Date(mix.createdAt).toLocaleDateString()}
                      </td>
                      <td className='px-4 py-3'>
                        <Button variant='outline' size='sm' asChild>
                          <Link to='/mixes/$mixId' params={{ mixId: mix.slug }}>
                            View
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {mixes.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
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
                        <Button variant='outline' size='sm' asChild>
                          <Link
                            to='/labels/$labelSlug'
                            params={{ labelSlug: label.slug }}>
                            View
                          </Link>
                        </Button>
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
    </div>
  )
}
