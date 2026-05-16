import { UploadProgress, type UploadStep } from './upload-progress'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/UploadProgress'
}

const steps: UploadStep[] = [
  'uploading-audio',
  'uploading-image',
  'creating-record',
  'success'
]

export function UploadProgressStates() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Upload'
        title='UploadProgress'
        description='Progress card shown during multi-step file upload.'
      />
      <div className='grid gap-4 max-w-md'>
        {steps.map((step) => (
          <UploadProgress
            key={step}
            step={step}
            title='Late Night Transmissions 04'
          />
        ))}
      </div>
    </div>
  )
}
