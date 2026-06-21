import { FolderOpen, Music, Trash2 } from 'lucide-react'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'

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
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader>
        <CardTitle className='flex items-center text-gb-pastel-green-1'>
          <Music className='w-5 h-5 mr-2' />
          Audio File
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='flex items-center justify-between p-3 rounded-sm bg-gb-bg'>
          <div className='flex items-center min-w-0 space-x-3'>
            <Music className='shrink-0 w-6 h-6 text-gb-highlight' />
            <div className='min-w-0'>
              <p className='font-medium leading-tight text-gb-pastel-green-1'>{displayName}</p>
              {displaySize && <p className='text-xs text-muted-foreground'>{displaySize}</p>}
            </div>
          </div>
          <div className='flex items-center gap-1 shrink-0'>
            {onPickFromS3 && (
              <Button
                variant='ghost'
                size='sm'
                onClick={onPickFromS3}
                className='text-gb-pastel-green-1 hover:text-gb-highlight'>
                <FolderOpen className='w-4 h-4' />
              </Button>
            )}
            <Button
              variant='ghost'
              size='sm'
              onClick={onRemove}
              className='text-red-400 hover:text-red-300'>
              <Trash2 className='w-4 h-4' />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
