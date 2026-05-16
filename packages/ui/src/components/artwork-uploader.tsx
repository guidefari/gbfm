import { ImageIcon, Upload, X } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useId } from 'react'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'

interface ArtworkUploaderProps {
  artworkFile: File | null
  artworkPreview: string | null
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  fallbackImageUrl?: string
}

export function ArtworkUploader({
  artworkFile,
  artworkPreview,
  onFileChange,
  onRemove,
  fallbackImageUrl = 'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'
}: ArtworkUploaderProps) {
  const inputId = useId()

  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader>
        <CardTitle className='flex items-center text-gb-pastel-green-1'>
          <ImageIcon className='w-5 h-5 mr-2' />
          Artwork
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!artworkFile && !artworkPreview ? (
          <div className='p-4 text-center transition-colors border-2 border-dashed rounded-sm border-gb-pastel-green-2/30 hover:border-gb-highlight/50'>
            <ImageIcon className='w-6 h-6 mx-auto mb-2 text-gb-pastel-green-2' />
            <p className='mb-2 text-xs text-gb-default-text'>
              Upload cover artwork
            </p>
            <input
              type='file'
              accept='image/*'
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
                  Choose Image
                </span>
              </Button>
            </label>
            <p className='mt-1 text-xs text-gb-default-text/70'>
              JPG, PNG, WebP (Max 10MB)
            </p>
          </div>
        ) : (
          <div className='space-y-3'>
            <div className='relative overflow-hidden border rounded-sm aspect-square bg-gb-bg border-gb-pastel-green-2/20'>
              <img
                src={artworkPreview || fallbackImageUrl}
                alt='Artwork preview'
                className='object-cover w-full h-full'
              />
              <Button
                variant='ghost'
                size='sm'
                onClick={onRemove}
                className='absolute text-white top-2 right-2 bg-black/50 hover:bg-black/70'>
                <X className='w-4 h-4' />
              </Button>
            </div>
            {artworkFile && (
              <p className='text-xs text-center text-gb-default-text'>
                {artworkFile.name} (
                {(artworkFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
