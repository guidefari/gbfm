import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea
} from '@gbfm/ui'
import { useId } from 'react'
import { generateSlug } from '@/hooks/useFileUpload'

interface AudioDetailsFormProps {
  title: string
  description: string
  slug: string
  contentTypeLabel: string
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onSlugChange: (value: string) => void
}

export function AudioDetailsForm({
  title,
  description,
  slug,
  contentTypeLabel,
  onTitleChange,
  onDescriptionChange,
  onSlugChange
}: AudioDetailsFormProps) {
  const titleId = useId()
  const descriptionId = useId()
  const slugId = useId()

  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader>
        <CardTitle className='text-gb-pastel-green-1'>Details</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor={titleId} className='text-gb-pastel-green-1'>
            Title *
          </Label>
          <Input
            id={titleId}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder='Enter audio title...'
            className='bg-gb-bg border-gb-pastel-green-2/30 text-gb-default-text focus:border-gb-highlight'
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor={descriptionId} className='text-gb-pastel-green-1'>
            Description
          </Label>
          <Textarea
            id={descriptionId}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder={`Brief description of your ${contentTypeLabel.toLowerCase()}...`}
            className='bg-gb-bg border-gb-pastel-green-2/30 text-gb-default-text focus:border-gb-highlight'
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor={slugId} className='text-gb-pastel-green-1'>
            URL Slug
          </Label>
          <Input
            id={slugId}
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder='url-friendly-slug (auto-generated if empty)'
            className='bg-gb-bg border-gb-pastel-green-2/30 text-gb-default-text focus:border-gb-highlight'
          />
          {title && !slug && (
            <p className='text-xs text-gb-default-text/70'>
              Will be auto-generated as: {generateSlug(title)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
