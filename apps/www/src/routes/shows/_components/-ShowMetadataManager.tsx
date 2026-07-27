import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Textarea,
  toast
} from '@gbfm/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { Settings2 } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { apiUrl, fetcher } from '@/lib/http'
import { ImageUploadField } from '@/routes/admin/_components/-ImageUploadField'

interface ShowMetadataFormState {
  title: string
  description: string
  thumbnailUrl: string
  bannerImageUrl: string
  content: string
  draft: boolean
  tags: string
}

interface ShowMetadataManagerProps {
  show: {
    id: string
    slug: string
    title: string
    description: string | null
    thumbnailUrl: string | null
    bannerImageUrl: string | null
    content: string
    draft: boolean
    tags: string[] | null
  }
}

export function ShowMetadataManager({ show }: ShowMetadataManagerProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState<ShowMetadataFormState>(() => ({
    title: show.title,
    description: show.description || '',
    thumbnailUrl: show.thumbnailUrl || '',
    bannerImageUrl: show.bannerImageUrl || '',
    content: show.content,
    draft: show.draft,
    tags: show.tags ? show.tags.join(', ') : ''
  }))

  const updateMutation = useMutation({
    mutationFn: (data: ShowMetadataFormState) =>
      fetcher(apiUrl(`/shows/${show.slug}`), {
        method: 'PATCH',
        body: JSON.stringify({
          title: data.title,
          description: data.description || undefined,
          thumbnailUrl: data.thumbnailUrl || undefined,
          bannerImageUrl: data.bannerImageUrl || undefined,
          content: data.content,
          draft: data.draft,
          tags: data.tags ? data.tags.split(',').map((t) => t.trim()) : undefined
        })
      }),
    onSuccess: () => {
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ['admin', 'shows'] })
      router.invalidate()
      toast({ title: 'Show updated' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to update show',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const isAdmin = session?.user?.role === 'admin'

  if (!isAdmin) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm' className='min-h-11'>
          <Settings2 className='w-4 h-4 mr-1.5' />
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Manage Show</DialogTitle>
          <DialogDescription>Update metadata for "{show.title}".</DialogDescription>
        </DialogHeader>
        <div className='grid gap-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='manage-title'>Title</Label>
            <Input
              id='manage-title'
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='manage-description'>Description</Label>
            <Textarea
              id='manage-description'
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <ImageUploadField
              label='Thumbnail (Square)'
              value={formData.thumbnailUrl}
              onChange={(url) => setFormData({ ...formData, thumbnailUrl: url })}
              variant='compact'
              size={200}
            />
            <ImageUploadField
              label='Banner (Landscape)'
              value={formData.bannerImageUrl}
              onChange={(url) => setFormData({ ...formData, bannerImageUrl: url })}
              variant='compact'
              size={200}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='manage-tags'>Tags (comma separated)</Label>
            <Input
              id='manage-tags'
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder='techno, house, ambient'
            />
          </div>
          <div className='flex items-center space-x-2'>
            <input
              type='checkbox'
              id='manage-draft'
              checked={formData.draft}
              onChange={(e) => setFormData({ ...formData, draft: e.target.checked })}
              className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary'
            />
            <Label htmlFor='manage-draft'>Draft</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => updateMutation.mutate(formData)}
            disabled={updateMutation.isPending || !formData.title}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
