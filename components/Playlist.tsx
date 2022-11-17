import React, { useState } from 'react'
import Track from './Track'
import * as ScrollArea from '@radix-ui/react-scroll-area'

interface Props {
  url: string
}

export const Playlist = () => {
  // const [selectedTrack, setselectedTrack] = useState()
  const TAGS = Array.from({ length: 50 }).map((_, i, a) => `v1.2.0-beta.${a.length - i}`)

  return (
    <section className="p-3 rounded-md bg-cyan-900 md:p-7">
      <h2>Playlist.name</h2>
      <div className="w-full grid-cols-3 gap-4 md:grid">
        <div className="col-span-1">
          {/* @ts-ignore */}
          <Track
            url={'https://open.spotify.com/track/0mSuk14kKUiC3Q6qj0u49o?si=fb91d9cc789c45ee'}
          />
        </div>
        <div className="col-span-2">
          <ScrollArea.Root className="w-full shadow-sm ScrollAreaRoot">
            <ScrollArea.Viewport className="h-full">
              <div style={{ padding: '15px 20px' }}>
                <h6 className="Text">Tracklist</h6>
                {TAGS.map((tag) => (
                  <div className="Tag" key={tag}>
                    {tag}
                  </div>
                ))}
              </div>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar className="ScrollAreaScrollbar" orientation="vertical">
              <ScrollArea.Thumb className="ScrollAreaThumb" />
            </ScrollArea.Scrollbar>
            <ScrollArea.Scrollbar className="ScrollAreaScrollbar" orientation="horizontal">
              <ScrollArea.Thumb className="ScrollAreaThumb" />
            </ScrollArea.Scrollbar>
            <ScrollArea.Corner className="ScrollAreaCorner" />
          </ScrollArea.Root>
        </div>
      </div>
    </section>
  )
}
