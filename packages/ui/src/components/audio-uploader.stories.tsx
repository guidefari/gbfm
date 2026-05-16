import { useState } from 'react'
import { AudioUploader } from './audio-uploader'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/AudioUploader'
}

export function AudioUploaders() {
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
        title='AudioUploader'
        description='Card-based audio file picker with preview and remove action.'
      />
      <div className='max-w-md space-y-6'>
        <div>
          <p className='text-xs text-muted-foreground mb-2'>Empty state</p>
          <AudioUploader
            audioFile={null}
            audioPreview={null}
            onFileChange={() => {}}
            onRemove={() => {}}
          />
        </div>
        <div>
          <p className='text-xs text-muted-foreground mb-2'>Interactive</p>
          <AudioUploader
            audioFile={file}
            audioPreview={preview}
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
