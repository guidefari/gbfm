import { Music, Trash2, Upload } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useId } from 'react'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'

interface AudioUploaderProps {
  audioFile: File | null
  audioPreview: string | null
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
}

export function AudioUploader({
  audioFile,
  audioPreview,
  onFileChange,
  onRemove
}: AudioUploaderProps) {
  const inputId = useId()

  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader>
        <CardTitle className='flex items-center text-gb-pastel-green-1'>
          <Music className='w-5 h-5 mr-2' />
          Audio File
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!audioFile ? (
          <div className='p-6 text-center transition-colors border-2 border-dashed rounded-sm border-gb-pastel-green-2/30 hover:border-gb-highlight/50'>
            <Music className='w-8 h-8 mx-auto mb-3 text-gb-pastel-green-2' />
            <p className='mb-3 text-base text-gb-default-text'>
              Drag and drop your audio file here
            </p>
            <input
              type='file'
              accept='audio/*'
              onChange={onFileChange}
              className='hidden'
              id={inputId}
            />
            <label htmlFor={inputId}>
              <Button
                variant='outline'
                size='sm'
                className='bg-transparent cursor-pointer border-gb-pastel-green-2/30 text-gb-pastel-green-1 hover:bg-gb-pastel-green-2/20'
                asChild>
                <span>
                  <Upload className='w-4 h-4 mr-2' />
                  Choose File
                </span>
              </Button>
            </label>
            <p className='mt-2 text-xs text-gb-default-text/70'>MP3, WAV, FLAC, M4A (Max 500MB)</p>
          </div>
        ) : (
          <div className='space-y-3'>
            <div className='flex items-center justify-between p-3 rounded-sm bg-gb-bg'>
              <div className='flex items-center min-w-0 space-x-3'>
                <Music className='shrink-0 w-6 h-6 text-gb-highlight' />
                <div className='min-w-0'>
                  <p className='font-medium leading-tight text-gb-pastel-green-1'>
                    {audioFile.name}
                  </p>
                  <p className='text-xs text-gb-default-text'>
                    {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                variant='ghost'
                size='sm'
                onClick={onRemove}
                className='shrink-0 text-red-400 hover:text-red-300'>
                <Trash2 className='w-4 h-4' />
              </Button>
            </div>
            {audioPreview && (
              /* oxlint-disable-next-line jsx-a11y/media-has-caption */
              <audio controls className='w-full'>
                <source src={audioPreview} />
                Your browser does not support the audio element.
              </audio>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
