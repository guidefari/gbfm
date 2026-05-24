import { useFeatureFlag } from '@gbfm/core/feature-flags'
import { AnimatePresence } from 'motion/react'
import type React from 'react'
import AudioPlayer from '@/components/AudioPlayer'
import FullscreenAudioPlayer from '@/components/FullscreenAudioPlayer'
import { QueueColumn } from '@/components/queue/QueueColumn'
import { useAudioPlayerInitializer } from '@/hooks/useAudioPlayer'
import { useMixPlayTracking } from '@/hooks/useMixPlayTracking'
import { MAIN_SCROLL_CONTAINER_ID } from '@/lib/constants'
import { useUIStore } from '@/store'
import { useAudioPlayerState } from '@/store/audioPlayer'

import { DesktopSideNav } from './DesktopSideNav'
import { FloatingMenu } from './FloatingMenu'
import { GlobalCompactPlayer } from './GlobalCompactPlayer'

type Props = {
  children: React.ReactNode
  showFooter?: boolean
}

export default function AppShell({ children }: Props) {
  useAudioPlayerInitializer()
  useMixPlayTracking()
  const isQueueEnabled = useFeatureFlag('ui.queue')

  const { audioSrc, isFullscreenVisible } = useAudioPlayerState()
  const { preferredPlayerType, showCompactPlayer } = useUIStore()
  const hasActiveAudio = Boolean(audioSrc)
  const showFullPlayer = !isFullscreenVisible && preferredPlayerType === 'full'

  const shouldShowCompactPlayer =
    hasActiveAudio &&
    !isFullscreenVisible &&
    preferredPlayerType === 'compact' &&
    showCompactPlayer

  return (
    <div className='grid h-screen w-full grid-cols-1 bg-background sm:grid-cols-[auto_1fr]'>
      <div className='hidden sm:block'>
        <DesktopSideNav />
      </div>
      <div className='relative flex h-screen min-w-0 flex-col overflow-hidden'>
        <main
          id={MAIN_SCROLL_CONTAINER_ID}
          tabIndex={-1}
          className='min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background pb-28 focus:outline-none sm:pb-32'>
          {children}
        </main>

        {showFullPlayer && hasActiveAudio && (
          <div className='absolute bottom-0 left-0 right-0 z-20 hidden sm:block'>
            <AudioPlayer />
          </div>
        )}

        {isQueueEnabled && <QueueColumn />}

        <FullscreenAudioPlayer />
      </div>

      <AnimatePresence>
        {shouldShowCompactPlayer && <GlobalCompactPlayer />}
      </AnimatePresence>

      <FloatingMenu className='fixed bottom-4 right-4 sm:hidden' />
    </div>
  )
}
