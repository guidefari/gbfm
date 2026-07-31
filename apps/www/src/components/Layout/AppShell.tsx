import { useFeatureFlag } from '@gbfm/core/feature-flags'
import { lazy, Suspense } from 'react'
import type React from 'react'
import AudioPlayer from '@/components/AudioPlayer'
import FullscreenAudioPlayer from '@/components/FullscreenAudioPlayer'
import { useMediaHotkeys } from '@/hooks/useMediaHotkeys'
import { MAIN_SCROLL_CONTAINER_ID } from '@/lib/constants'
import { useNowPlayingTrack, useVisibility } from '@/services/player'
import { useUIState } from '@/store'

import { StationNav } from './StationNav'

const QueueColumn = lazy(() =>
  import('@/components/queue/QueueColumn').then((m) => ({ default: m.QueueColumn }))
)

type Props = {
  children: React.ReactNode
  showFooter?: boolean
}

export default function AppShell({ children }: Props) {
  useMediaHotkeys()
  const isQueueEnabled = useFeatureFlag('ui.queue')

  const currentTrack = useNowPlayingTrack()
  const { isFullscreenVisible } = useVisibility()
  const { showBottomPlayer } = useUIState()
  const hasActiveAudio = Boolean(currentTrack)
  const showPlayer = showBottomPlayer && !isFullscreenVisible && hasActiveAudio

  return (
    <div className='grid h-dvh w-full grid-cols-1 bg-background'>
      <div className='relative flex h-dvh min-w-0 flex-col overflow-hidden'>
        <StationNav className='z-40 shrink-0 pt-[env(safe-area-inset-top)]' />

        <div className='relative min-h-0 flex-1'>
          <main
            id={MAIN_SCROLL_CONTAINER_ID}
            tabIndex={-1}
            style={{ overflowAnchor: 'none' }}
            className='h-full min-w-0 overflow-x-hidden overflow-y-auto bg-background pb-[calc(2.75rem+env(safe-area-inset-bottom))] focus:outline-none lg:pb-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]'>
            {children}
          </main>
        </div>

        {showPlayer && (
          <div className='z-20 hidden shrink-0 lg:block pb-[env(safe-area-inset-bottom)]'>
            <AudioPlayer />
          </div>
        )}

        {isQueueEnabled && (
          <Suspense fallback={null}>
            <QueueColumn />
          </Suspense>
        )}

        <FullscreenAudioPlayer />
      </div>
    </div>
  )
}
