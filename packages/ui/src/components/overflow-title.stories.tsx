import { OverflowTitle } from './overflow-title'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/OverflowTitle'
}

export function OverflowTitles() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Typography'
        title='OverflowTitle'
        description='Marquee animation kicks in when text overflows its container.'
      />
      <div className='space-y-6'>
        <div>
          <p className='text-xs text-muted-foreground mb-2'>
            Short title (no marquee)
          </p>
          <div className='w-64 border border-border p-2'>
            <OverflowTitle text='Burial – Untrue' />
          </div>
        </div>
        <div>
          <p className='text-xs text-muted-foreground mb-2'>
            Long title in narrow container (marquee active)
          </p>
          <div className='w-48 border border-border p-2'>
            <OverflowTitle text='Late Night Transmissions Vol. 04 — A Journey Through Dub and Leftfield Electronics' />
          </div>
        </div>
        <div>
          <p className='text-xs text-muted-foreground mb-2'>
            Wide container (no marquee)
          </p>
          <div className='w-full border border-border p-2'>
            <OverflowTitle text='Late Night Transmissions Vol. 04 — A Journey Through Dub and Leftfield Electronics' />
          </div>
        </div>
      </div>
    </div>
  )
}
