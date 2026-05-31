import { MixUploadProgress, type MixUploadStep } from './mix-upload-progress'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/MixUploadProgress'
}

const steps: MixUploadStep[] = ['uploading-audio', 'uploading-image', 'creating-record']

export function MixUploadProgressStates() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Upload'
        title='MixUploadProgress'
        description='Compact inline progress indicator for mix uploads.'
      />
      <div className='space-y-4'>
        {steps.map((step) => (
          <MixUploadProgress key={step} step={step} />
        ))}
      </div>
    </div>
  )
}
