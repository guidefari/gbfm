import { Button } from './button'
import { MediaCard as MediaCardComponent } from './media-card'
import { mediaExamples, StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Media/Media card'
}

export function MediaCard() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Product seed'
        title='MediaCard'
        description='A presentational music pattern with app behavior passed in as actions.'
      />
      <div className='grid gap-5 md:grid-cols-2'>
        {mediaExamples.map((example) => (
          <MediaCardComponent
            key={example.title}
            title={example.title}
            eyebrow={example.eyebrow}
            imageUrl={example.imageUrl}
            description={example.description}
            tags={example.tags}
            actions={
              <>
                <Button size='sm'>Play</Button>
                <Button size='sm' variant='outline'>
                  Save
                </Button>
              </>
            }
            footer='Playback, sharing, and persistence stay outside @gbfm/ui.'
          />
        ))}
      </div>
    </div>
  )
}
