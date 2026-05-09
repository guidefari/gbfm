import { FolderOpen, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { useId, useState } from 'react'
import { S3MediaFilePicker } from '@/components/mix-uploader/S3AudioFilePicker'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { VPS_BASE_URL } from '@/lib/http'

interface ImageUploadFieldProps {
  label: string
  value: string
  onChange: (url: string) => void
}

export function ImageUploadField({
  label,
  value,
  onChange
}: ImageUploadFieldProps) {
  const inputId = useId()
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)

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

  const handleSelectExistingImage = (url: string) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    onChange(url)
    toast({ title: 'Image selected' })
  }

  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <div className='flex items-start gap-4'>
        <div className='relative w-32 h-32 overflow-hidden border rounded-md shrink-0 bg-muted'>
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={label}
              className='object-cover w-full h-full'
            />
          ) : (
            <label
              htmlFor={inputId}
              className='flex flex-col items-center justify-center w-full h-full gap-1 cursor-pointer border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors'>
              <ImageIcon className='w-6 h-6 text-muted-foreground' />
              <span className='text-xs text-muted-foreground'>No image</span>
            </label>
          )}
          {isUploading && (
            <div className='absolute inset-0 flex items-center justify-center bg-black/50'>
              <Loader2 className='w-5 h-5 text-white animate-spin' />
            </div>
          )}
          <input
            type='file'
            accept='image/*'
            onChange={handleFileChange}
            className='hidden'
            id={inputId}
            disabled={isUploading}
          />
        </div>

        <div className='flex flex-col flex-1 min-w-0 gap-2'>
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              asChild
              disabled={isUploading}>
              <label htmlFor={inputId} className='cursor-pointer'>
                <Upload className='w-3.5 h-3.5 mr-2' />
                {displayUrl ? 'Replace' : 'Upload'}
              </label>
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setMediaPickerOpen(true)}
              disabled={isUploading}>
              <FolderOpen className='w-3.5 h-3.5 mr-2' />
              Bucket
            </Button>
            {displayUrl && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={handleRemove}
                disabled={isUploading}
                className='text-destructive hover:text-destructive'>
                <Trash2 className='w-3.5 h-3.5 mr-2' />
                Remove
              </Button>
            )}
          </div>
          {value && (
            <p className='text-xs truncate text-muted-foreground' title={value}>
              {value}
            </p>
          )}
        </div>
      </div>

      <S3MediaFilePicker
        open={mediaPickerOpen}
        onOpenChange={setMediaPickerOpen}
        mediaType='image'
        onSelect={handleSelectExistingImage}
      />
    </div>
  )
}
