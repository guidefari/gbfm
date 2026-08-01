import { AudioDropZone } from './audio-drop-zone'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Workflows/Audio drop zone'
}

export function AudioDropZones() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Upload'
        title='AudioDropZone'
        description='Drag-and-drop zone for selecting audio files.'
      />
      <div className='space-y-6 max-w-xl'>
        <div>
          <p className='text-xs text-muted-foreground mb-2'>Basic (no S3 option)</p>
          <AudioDropZone onFileSelect={() => {}} />
        </div>
        <div>
          <p className='text-xs text-muted-foreground mb-2'>With S3 bucket picker</p>
          <AudioDropZone
            onFileSelect={() => {}}
            onPickFromS3={() => {}}
            secondaryActionLabel='Pick from S3 bucket'
          />
        </div>
      </div>
    </div>
  )
}
