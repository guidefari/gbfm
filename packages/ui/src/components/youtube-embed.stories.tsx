import { StoryPanelHeader, storyPanelClassName } from './story-helpers'
import YoutubeEmbed from './youtube-embed'

export default {
  title: '@gbfm/ui/YoutubeEmbed'
}

export function YoutubeEmbeds() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Media'
        title='YoutubeEmbed'
        description='Responsive iframe embed for YouTube videos.'
      />
      <div className='space-y-6'>
        <div>
          <p className='text-xs text-muted-foreground mb-2'>Default (100% width, 420px height)</p>
          <YoutubeEmbed id='dQw4w9WgXcQ' />
        </div>
        <div>
          <p className='text-xs text-muted-foreground mb-2'>Custom dimensions</p>
          <YoutubeEmbed id='dQw4w9WgXcQ' width={480} height={270} />
        </div>
      </div>
    </div>
  )
}
