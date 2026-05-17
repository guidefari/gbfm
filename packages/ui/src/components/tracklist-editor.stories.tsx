import { useState } from 'react'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'
import { type TrackEntry, TracklistEditor } from './tracklist-editor'

export default {
  title: '@gbfm/ui/TracklistEditor'
}

export function Tracklist() {
  const [tracks, setTracks] = useState<TrackEntry[]>([
    { id: 1, time: 0, title: 'Burial - Archangel' },
    { id: 2, time: 312, title: 'Four Tet - She Moves She' },
    { id: 3, time: 667, title: 'Actress - Maze' }
  ])
  const [currentTime] = useState(245)

  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Editor'
        title='TracklistEditor'
        description='Mark track timestamps while audio plays. Edit titles inline.'
      />
      <div className='max-w-lg'>
        <TracklistEditor
          tracklist={tracks}
          currentTime={currentTime}
          onAddTrack={() => {
            setTracks((prev) => [
              ...prev,
              { id: Date.now(), time: currentTime, title: '' }
            ])
          }}
          onUpdateTrack={(index, title) => {
            setTracks((prev) =>
              prev.map((t, i) => (i === index ? { ...t, title } : t))
            )
          }}
          onRemoveTrack={(id) => {
            setTracks((prev) => prev.filter((t) => t.id !== id))
          }}
          onSeekTo={(seconds) => console.log('seek to', seconds)}
        />
      </div>
    </div>
  )
}
