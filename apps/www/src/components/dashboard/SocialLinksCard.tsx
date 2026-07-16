import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { Button, Card, CardContent, CardHeader, CardTitle, useToast } from '@gbfm/ui'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SortableSocialLinkRow } from '@/components/profile/social-link-fields'
import { type SocialLink, useReplaceSocialLinks, useSocialLinks } from '@/lib/http'

type DraftLink = SocialLink & { tempId: string }

export function SocialLinksCard() {
  const socialLinksQuery = useSocialLinks()
  const replaceSocialLinksMutation = useReplaceSocialLinks()
  const { toast } = useToast()
  const [draft, setDraft] = useState<DraftLink[]>([])

  useEffect(() => {
    if (socialLinksQuery.data) {
      setDraft(
        socialLinksQuery.data.map((link, index) => ({
          ...link,
          tempId: `${link.platform}-${index}-${crypto.randomUUID()}`
        }))
      )
    }
  }, [socialLinksQuery.data])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setDraft((prev) => {
      const oldIndex = prev.findIndex((item) => item.tempId === active.id)
      const newIndex = prev.findIndex((item) => item.tempId === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev

      return arrayMove(prev, oldIndex, newIndex).map((item, index) => ({
        ...item,
        position: index
      }))
    })
  }

  const handleAdd = () => {
    setDraft((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), platform: 'bandcamp', url: '', position: prev.length }
    ])
  }

  const handleSave = () => {
    const cleaned = draft
      .map(({ tempId, ...rest }) => rest)
      .filter((link) => link.url.trim().length > 0)
      .map((link, index) => ({ ...link, position: index }))

    replaceSocialLinksMutation.mutate(cleaned, {
      onSuccess: (links) => {
        setDraft(
          links.map((link, index) => ({
            ...link,
            tempId: `${link.platform}-${index}-${crypto.randomUUID()}`
          }))
        )
        toast({ title: 'Social links updated' })
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Failed to update social links',
          description: error.message
        })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>Social Links</CardTitle>
          <Button type='button' variant='outline' size='sm' onClick={handleAdd}>
            <Plus className='mr-2 h-4 w-4' />
            Add Link
          </Button>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <p className='text-xs text-muted-foreground'>
          Drag to reorder. Empty URLs are ignored on save.
        </p>

        {socialLinksQuery.isPending ? (
          <p className='text-sm text-muted-foreground'>Loading social links...</p>
        ) : draft.length === 0 ? (
          <div className='rounded-sm border border-dashed p-4 text-sm text-muted-foreground'>
            No social links yet.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}>
            <SortableContext
              items={draft.map((item) => item.tempId)}
              strategy={verticalListSortingStrategy}>
              <div className='space-y-2'>
                {draft.map((link) => (
                  <SortableSocialLinkRow
                    key={link.tempId}
                    link={link}
                    onChange={(next) =>
                      setDraft((prev) =>
                        prev.map((item) =>
                          item.tempId === link.tempId ? { ...next, tempId: link.tempId } : item
                        )
                      )
                    }
                    onRemove={() =>
                      setDraft((prev) =>
                        prev
                          .filter((item) => item.tempId !== link.tempId)
                          .map((item, index) => ({ ...item, position: index }))
                      )
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <Button
          type='button'
          className='w-full'
          onClick={handleSave}
          disabled={replaceSocialLinksMutation.isPending}>
          {replaceSocialLinksMutation.isPending ? 'Saving...' : 'Save Social Links'}
        </Button>
      </CardContent>
    </Card>
  )
}
