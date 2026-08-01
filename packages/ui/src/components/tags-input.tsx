import { X } from 'lucide-react'
import { useId, useState } from 'react'
import { Badge } from './badge'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'

interface TagsInputProps {
  tags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  contentTypeLabel: string
}

export function TagsInput({ tags, onAddTag, onRemoveTag, contentTypeLabel }: TagsInputProps) {
  const [newTag, setNewTag] = useState('')
  const inputId = useId()

  const handleAddTag = () => {
    const trimmed = newTag.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onAddTag(trimmed)
      setNewTag('')
    }
  }

  return (
    <div className='space-y-2'>
      <Label htmlFor={inputId}>Tags</Label>
      <div className='flex gap-2'>
        <Input
          id={inputId}
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder='Add a tag...'
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddTag()
            }
          }}
        />
        <Button type='button' onClick={handleAddTag} variant='outline'>
          Add
        </Button>
      </div>

      {tags.length > 0 ? (
        <div className='flex flex-wrap gap-1.5'>
          {tags.map((tag) => (
            <Badge key={tag} variant='outline' className='gap-1 font-normal'>
              {tag}
              <button
                type='button'
                aria-label={`Remove ${tag}`}
                onClick={() => onRemoveTag(tag)}
                className='rounded-sm text-muted-foreground transition-colors hover:text-destructive'>
                <X className='size-3' />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className='text-xs text-muted-foreground'>
          Add tags to help people discover your {contentTypeLabel}
        </p>
      )}
    </div>
  )
}
