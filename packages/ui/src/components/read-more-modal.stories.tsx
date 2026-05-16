import { ReadMoreModal } from './read-more-modal'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/ReadMoreModal'
}

export function ReadMoreModals() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Overlay'
        title='ReadMoreModal'
        description='Dialog on desktop, bottom sheet on mobile. Click trigger to open.'
      />
      <ReadMoreModal
        title='About Late Night Transmissions 04'
        trigger={
          <span className='underline cursor-pointer text-sm text-muted-foreground hover:text-foreground'>
            Read more...
          </span>
        }>
        <p>
          Dubwise pressure, loose percussion, and slow-burning warehouse
          records. Recorded live at The Bunker, this set traces a line from dub
          techno to fourth-world ambience.
        </p>
        <p>
          Tracklist included. All tracks sourced from independent labels and
          Bandcamp releases. Support the artists.
        </p>
      </ReadMoreModal>
    </div>
  )
}
