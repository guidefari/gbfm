import { useState } from 'react'
import { ArtworkUploader } from './artwork-uploader'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/ArtworkUploader'
}

export function ArtworkUploaders() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    if (f) setPreview(URL.createObjectURL(f))
  }

  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Upload'
        title='ArtworkUploader'
        description='Card-based image picker with preview and fallback URL support.'
      />
      <div className='max-w-md space-y-6'>
        <div>
          <p className='text-xs text-muted-foreground mb-2'>
            Empty state (with fallback image)
          </p>
          <ArtworkUploader
            artworkFile={null}
            artworkPreview={null}
            onFileChange={() => {}}
            onRemove={() => {}}
          />
        </div>
        <div>
          <p className='text-xs text-muted-foreground mb-2'>Interactive</p>
          <ArtworkUploader
            artworkFile={file}
            artworkPreview={preview}
            onFileChange={handleChange}
            onRemove={() => {
              setFile(null)
              setPreview(null)
            }}
          />
        </div>
      </div>
    </div>
  )
}
