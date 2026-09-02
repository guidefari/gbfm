import { X } from 'lucide-react'
import { useId, useState } from 'react'
import { Badge } from './badge'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'

interface TagsInputProps {
  tags: string[]
  availableTags?: readonly string[]
  label?: string
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  contentTypeLabel: string
}

export function TagsInput({
  tags,
  availableTags = [],
  label = 'Tags',
  onAddTag,
  onRemoveTag,
  contentTypeLabel
}: TagsInputProps) {
  const [newTag, setNewTag] = useState('')
  const inputId = useId()
  const searchTerm = newTag.trim().toLocaleLowerCase()
  const selectedTagNames = new Set(tags.map((tag) => tag.toLocaleLowerCase()))
  const suggestions = availableTags
    .filter((tag) => !selectedTagNames.has(tag.toLocaleLowerCase()))
    .filter((tag) => !searchTerm || tag.toLocaleLowerCase().includes(searchTerm))
    .slice(0, 8)

  const addTag = (tag: string) => {
    const existingTag = availableTags.find(
      (availableTag) => availableTag.toLocaleLowerCase() === tag.toLocaleLowerCase()
    )
    const nextTag = existingTag ?? tag
    if (
      !tags.some((selectedTag) => selectedTag.toLocaleLowerCase() === nextTag.toLocaleLowerCase())
    ) {
      onAddTag(nextTag)
    }
    setNewTag('')
  }

  const handleAddTag = () => {
    const trimmed = newTag.trim()
    if (trimmed) addTag(trimmed)
  }

  return (
    <div className='space-y-2'>
      <Label htmlFor={inputId}>{label}</Label>
      {suggestions.length > 0 ? (
        <div className='flex flex-wrap gap-1.5' aria-label='Existing tags'>
          {suggestions.map((tag) => (
            <Button
              key={tag}
              type='button'
              variant='outline'
              size='sm'
              onClick={() => addTag(tag)}
              className='h-8 px-2.5 text-xs'>
              {tag}
            </Button>
          ))}
        </div>
      ) : null}
      <div className='flex gap-2'>
        <Input
          id={inputId}
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder='Search or create a tag...'
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddTag()
            }
          }}
        />
        <Button
          type='button'
          onClick={handleAddTag}
          variant='outline'
          size='sm'
          className='h-9 px-4 text-sm'
          disabled={!newTag.trim()}>
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
          Choose a shared tag or create one for this {contentTypeLabel}
        </p>
      )}
    </div>
  )
}
