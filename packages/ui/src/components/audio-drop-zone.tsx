import { FolderOpen, Upload } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { Button } from './button'

interface AudioDropZoneProps {
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void
  onPickFromS3?: () => void
  secondaryActionLabel?: string
}

export function AudioDropZone({
  onFileSelect,
  onPickFromS3,
  secondaryActionLabel = 'Pick from S3 bucket'
}: AudioDropZoneProps) {
  return (
    <div className='space-y-3'>
      <div className='relative p-12 text-center transition-colors border-2 border-dashed cursor-pointer group rounded-sm bg-gb-darker-bg border-gb-pastel-green-2/30 hover:border-gb-highlight/50'>
        <input
          type='file'
          accept='audio/*'
          onChange={onFileSelect}
          className='absolute inset-0 opacity-0 cursor-pointer'
        />
        <div className='flex items-center justify-center w-16 h-16 mx-auto mb-4 transition-transform rounded-sm bg-gb-pastel-green-2/20 group-hover:scale-110'>
          <Upload className='w-8 h-8 text-gb-highlight' />
        </div>
        <h2 className='mb-2 text-xl font-semibold text-gb-pastel-green-1'>Select your mix file</h2>
        <p className='text-muted-foreground'>
          MP3, WAV, or AIFF supported. Title will be inferred automatically.
        </p>
      </div>

      {onPickFromS3 && (
        <div className='flex items-center gap-3'>
          <div className='flex-1 h-px bg-gb-pastel-green-2/20' />
          <span className='text-xs text-muted-foreground'>or</span>
          <div className='flex-1 h-px bg-gb-pastel-green-2/20' />
        </div>
      )}

      {onPickFromS3 && (
        <Button
          type='button'
          variant='outline'
          className='w-full border-gb-pastel-green-2/30 text-gb-pastel-green-1 hover:border-gb-highlight/50 hover:text-gb-highlight'
          onClick={onPickFromS3}>
          <FolderOpen className='w-4 h-4 mr-2' />
          {secondaryActionLabel}
        </Button>
      )}
    </div>
  )
}
