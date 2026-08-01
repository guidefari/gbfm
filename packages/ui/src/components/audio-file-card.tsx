import { FolderOpen, Music, Trash2 } from 'lucide-react'
import { Button } from './button'

interface AudioFileCardProps {
  fileName?: string
  fileSize?: number
  existingUrl?: string
  onRemove: () => void
  onPickFromS3?: () => void
}

export function AudioFileCard({
  fileName,
  fileSize,
  existingUrl,
  onRemove,
  onPickFromS3
}: AudioFileCardProps) {
  const displayName = fileName || (existingUrl ? existingUrl.split('/').pop() : 'Unknown file')

  const displaySize = fileSize ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB` : ''

  return (
    <div className='flex items-center gap-3 border border-border bg-card px-3 py-2'>
      <Music className='size-4 shrink-0 text-highlight' />

      <div className='min-w-0 flex-1'>
        <p className='truncate text-base leading-tight text-foreground'>{displayName}</p>
      </div>

      {displaySize && (
        <span className='shrink-0 text-xs tabular-nums text-muted-foreground'>{displaySize}</span>
      )}

      <div className='flex shrink-0 items-center'>
        {onPickFromS3 && (
          <Button
            variant='ghost'
            size='sm'
            onClick={onPickFromS3}
            aria-label='Pick from library'
            className='size-7 p-0 text-muted-foreground hover:text-highlight'>
            <FolderOpen className='size-4' />
          </Button>
        )}
        <Button
          variant='ghost'
          size='sm'
          onClick={onRemove}
          aria-label='Remove file'
          className='size-7 p-0 text-muted-foreground hover:text-destructive'>
          <Trash2 className='size-4' />
        </Button>
      </div>
    </div>
  )
}
