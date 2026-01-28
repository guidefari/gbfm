import { ImageIcon, Loader2, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { VPS_BASE_URL } from '@/lib/http'

interface ImageUploadFieldProps {
  label: string
  value: string
  onChange: (url: string) => void
  aspectRatio?: 'square' | 'landscape'
}

export function ImageUploadField({
  label,
  value,
  onChange,
  aspectRatio = 'square'
}: ImageUploadFieldProps) {
  const inputId = useId()
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const displayUrl = previewUrl || value

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('imageFile', file)
      formData.append('fileType', 'image')

      const response = await fetch(`${VPS_BASE_URL}/upload/file`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      const result = await response.json()
      onChange(result.url)
      toast({ title: 'Image uploaded successfully' })
    } catch (error) {
      toast({
        title: 'Failed to upload image',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
      setPreviewUrl(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    onChange('')
  }

  const aspectClass =
    aspectRatio === 'landscape' ? 'aspect-video' : 'aspect-square'

  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      {displayUrl ? (
        <div className='relative'>
          <div
            className={`${aspectClass} overflow-hidden rounded-sm border bg-muted`}>
            <img
              src={displayUrl}
              alt={label}
              className='h-full w-full object-cover'
            />
            {isUploading && (
              <div className='absolute inset-0 flex items-center justify-center bg-black/50'>
                <Loader2 className='h-6 w-6 animate-spin text-white' />
              </div>
            )}
          </div>
          <Button
            type='button'
            variant='destructive'
            size='sm'
            className='absolute right-2 top-2'
            onClick={handleRemove}
            disabled={isUploading}>
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      ) : (
        <div
          className={`${aspectClass} relative flex items-center justify-center rounded-sm border-2 border-dashed bg-muted/50 transition-colors hover:border-primary/50`}>
          <input
            type='file'
            accept='image/*'
            onChange={handleFileChange}
            className='hidden'
            id={inputId}
            disabled={isUploading}
          />
          <label
            htmlFor={inputId}
            className='flex cursor-pointer flex-col items-center gap-2 p-4'>
            {isUploading ? (
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
            ) : (
              <>
                <ImageIcon className='h-8 w-8 text-muted-foreground' />
                <span className='text-sm text-muted-foreground'>
                  Click to upload
                </span>
              </>
            )}
          </label>
        </div>
      )}
    </div>
  )
}
