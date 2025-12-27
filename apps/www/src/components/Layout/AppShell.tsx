import { useLocation } from '@tanstack/react-router'
import type React from 'react'
import AudioPlayer from '@/components/AudioPlayer'
import FullscreenAudioPlayer from '@/components/FullscreenAudioPlayer'
import { QueueColumn } from '@/components/queue/QueueColumn'
import { useAudioPlayerInitializer } from '@/hooks/useAudioPlayer'
import { useAudioPlayerState } from '@/store/audioPlayer'

import { DesktopSideNav } from './DesktopSideNav'
import { FloatingMenu } from './FloatingMenu'

type Props = {
  children: React.ReactNode
  showFooter?: boolean
}

export default function AppShell({ children }: Props) {
  useAudioPlayerInitializer()

  const { audioSrc, isFullscreenVisible } = useAudioPlayerState()
  const location = useLocation()
  const hasActiveAudio = Boolean(audioSrc)
  const isOnMixesPage = location.pathname.startsWith('/mixes')

  return (
    <div className='grid sm:grid-cols-[auto_1fr] h-screen w-full bg-background'>
      <div className='hidden sm:block'>
        <DesktopSideNav />
      </div>
      <div className='flex flex-col h-screen overflow-hidden'>
        <main className='flex-1 overflow-y-auto bg-background'>{children}</main>

        {hasActiveAudio && !isFullscreenVisible && !isOnMixesPage && (
          <div className='flex-shrink-0 hidden sm:block'>
            <AudioPlayer />
          </div>
        )}

        <QueueColumn />

        <FullscreenAudioPlayer />
      </div>

      <FloatingMenu className='fixed bottom-4 right-4 sm:hidden' />
    </div>
  )
}
