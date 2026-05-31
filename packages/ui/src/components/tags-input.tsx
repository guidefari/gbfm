import { X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from './badge'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Input } from './input'

interface TagsInputProps {
  tags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  contentTypeLabel: string
}

export function TagsInput({ tags, onAddTag, onRemoveTag, contentTypeLabel }: TagsInputProps) {
  const [newTag, setNewTag] = useState('')

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      onAddTag(newTag.trim())
      setNewTag('')
    }
  }

  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader>
        <CardTitle className='text-gb-pastel-green-1'>Tags</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex gap-2'>
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder='Add a tag...'
            className='bg-gb-bg border-gb-pastel-green-2/30 text-gb-default-text focus:border-gb-highlight'
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddTag()
              }
            }}
          />
          <Button
            onClick={handleAddTag}
            variant='outline'
            className='bg-transparent border-gb-pastel-green-2/30 text-gb-pastel-green-1 hover:bg-gb-pastel-green-2/20'>
            Add
          </Button>
        </div>

        <div className='flex flex-wrap gap-2'>
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant='secondary'
              className='flex items-center gap-1 bg-gb-pastel-green-2/20 text-gb-pastel-green-1'>
              {tag}
              <X
                className='w-3 h-3 cursor-pointer hover:text-gb-highlight'
                onClick={() => onRemoveTag(tag)}
              />
            </Badge>
          ))}
        </div>

        {tags.length === 0 && (
          <p className='text-xs text-gb-default-text/70'>
            Add tags to help people discover your {contentTypeLabel}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
