import { useState } from 'react'
import {
  type PlaybackState,
  PlayToggle as PlayToggleComponent,
  playbackStates
} from './play-toggle'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/New/Play toggle'
}

const allStates = Object.values(playbackStates)
const variants = ['icon', 'button', 'hero'] as const

export function PlayToggle() {
  const [state, setState] = useState<PlaybackState>(playbackStates.idle)

  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Primitive'
        title='PlayToggle'
        description='Presentational playback control. The app owns the player; this renders idle, loading, playing, and error without depending on @gbfm/player.'
      />

      <section className='space-y-3'>
        <h2 className='text-sm tracking-[0.2em] text-muted-foreground'>Interactive</h2>
        <div className='flex flex-wrap items-center gap-6 border border-border p-6'>
          <PlayToggleComponent
            state={state}
            variant='button'
            label='Late Night Transmissions 04'
            onToggle={() =>
              setState((current) =>
                current === playbackStates.playing ? playbackStates.idle : playbackStates.playing
              )
            }
          />
          <div className='flex flex-wrap gap-2'>
            {allStates.map((candidate) => (
              <button
                key={candidate}
                type='button'
                onClick={() => setState(candidate)}
                className='border border-border px-3 py-1 text-xs hover:border-highlight'>
                {candidate}
              </button>
            ))}
          </div>
        </div>
      </section>

      {variants.map((variant) => (
        <section key={variant} className='space-y-3'>
          <h2 className='text-sm tracking-[0.2em] text-muted-foreground'>variant={variant}</h2>
          <div className='flex flex-wrap items-center gap-6 border border-border p-6'>
            {allStates.map((candidate) => (
              <div key={candidate} className='space-y-2 text-center'>
                <PlayToggleComponent
                  state={candidate}
                  variant={variant}
                  label='Late Night Transmissions 04'
                  onToggle={() => {}}
                />
                <p className='text-xs text-muted-foreground'>{candidate}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
