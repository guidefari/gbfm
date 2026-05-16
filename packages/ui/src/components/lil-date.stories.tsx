import { LilDate } from './lil-date'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/LilDate'
}

export function Dates() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Typography'
        title='LilDate'
        description='Compact date display with semantic time element.'
      />
      <div className='space-y-4'>
        <div>
          <p className='text-xs text-muted-foreground mb-1'>String input</p>
          <LilDate date='2024-03-15' />
        </div>
        <div>
          <p className='text-xs text-muted-foreground mb-1'>Date object</p>
          <LilDate date={new Date(2023, 11, 31)} />
        </div>
        <div>
          <p className='text-xs text-muted-foreground mb-1'>Today</p>
          <LilDate date={new Date()} />
        </div>
      </div>
    </div>
  )
}
