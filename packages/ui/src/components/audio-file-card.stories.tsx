import { AudioFileCard } from './audio-file-card'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Media/Audio file card'
}

export function AudioFileCards() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Upload'
        title='AudioFileCard'
        description='Displays a selected audio file with remove action.'
      />
      <div className='grid gap-4 max-w-md'>
        <AudioFileCard
          fileName='late-night-transmissions-04.mp3'
          fileSize={87_654_321}
          onRemove={() => {}}
        />
        <AudioFileCard
          existingUrl='https://cdn.example.com/uploads/mix-123.wav'
          onRemove={() => {}}
        />
      </div>
    </div>
  )
}
