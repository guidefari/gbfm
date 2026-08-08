import { useFeatureFlag } from '@gbfm/core/feature-flags'
import { lazy, Suspense } from 'react'
import type React from 'react'
import FullscreenAudioPlayer from '@/components/FullscreenAudioPlayer'
import { useMediaHotkeys } from '@/hooks/useMediaHotkeys'
import { MAIN_SCROLL_CONTAINER_ID } from '@/lib/constants'

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

  return (
    <div className='grid h-dvh w-full grid-cols-1 bg-background'>
      <div className='relative flex h-dvh min-w-0 flex-col overflow-hidden'>
        <div className='relative min-h-0 flex-1'>
          <main
            id={MAIN_SCROLL_CONTAINER_ID}
            tabIndex={-1}
            style={{ overflowAnchor: 'none' }}
            className='h-full min-w-0 overflow-x-hidden overflow-y-auto bg-background pb-[calc(2.75rem+env(safe-area-inset-bottom))] focus:outline-none lg:pb-12 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]'>
            {children}
          </main>
        </div>

        <StationNav />

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
