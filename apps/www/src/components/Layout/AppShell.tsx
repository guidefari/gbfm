import { useFeatureFlag } from '@gbfm/core/feature-flags'
import { lazy, Suspense } from 'react'
import type React from 'react'
import AudioPlayer from '@/components/AudioPlayer'
import FullscreenAudioPlayer from '@/components/FullscreenAudioPlayer'
import { useAudioPlayerInitializer } from '@/hooks/useAudioPlayer'
import { useMediaHotkeys } from '@/hooks/useMediaHotkeys'
import { useMixPlayTracking } from '@/hooks/useMixPlayTracking'
import { MAIN_SCROLL_CONTAINER_ID } from '@/lib/constants'
import { useUIStore } from '@/store'
import { useAudioPlayerPlaybackState, useAudioPlayerVisibilityState } from '@/store/audioPlayer'

import { FloatingMenu } from './FloatingMenu'

const QueueColumn = lazy(() =>
  import('@/components/queue/QueueColumn').then((m) => ({ default: m.QueueColumn }))
)

type Props = {
  children: React.ReactNode
  showFooter?: boolean
}

export default function AppShell({ children }: Props) {
  useAudioPlayerInitializer()
  useMixPlayTracking()
  useMediaHotkeys()
  const isQueueEnabled = useFeatureFlag('ui.queue')

  const { audioSrc } = useAudioPlayerPlaybackState()
  const { isFullscreenVisible } = useAudioPlayerVisibilityState()
  const { showBottomPlayer } = useUIStore()
  const hasActiveAudio = Boolean(audioSrc)
  const showPlayer = showBottomPlayer && !isFullscreenVisible && hasActiveAudio

  return (
    <div className='grid h-dvh w-full grid-cols-1 bg-background'>
      <div className='relative flex h-dvh min-w-0 flex-col overflow-hidden'>
        <div className='relative min-h-0 flex-1'>
          <main
            id={MAIN_SCROLL_CONTAINER_ID}
            tabIndex={-1}
            style={{ overflowAnchor: 'none' }}
            className='h-full min-w-0 overflow-x-hidden overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] bg-background focus:outline-none'>
            {children}
          </main>

          <FloatingMenu className='absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))]' />
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
