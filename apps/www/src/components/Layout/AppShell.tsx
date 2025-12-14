import { useLocation } from '@tanstack/react-router'
import type React from 'react'
import AudioPlayer from '@/components/AudioPlayer'
import FullscreenAudioPlayer from '@/components/FullscreenAudioPlayer'
import { QueueColumn } from '@/components/queue/QueueColumn'
import { useAudioPlayerInitializer } from '@/hooks/useAudioPlayer'
import { useAudioPlayerState } from '@/store/audioPlayer'

// import { HorizontalMenu } from "./HorizontalMenu";
// import { DesktopSideNav } from "./DesktopSideNav";

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
    <div className='flex flex-col h-screen bg-background'>
      <main className='flex-1 overflow-y-auto bg-background'>{children}</main>

      {/* Audio Player - Fixed at bottom, full width */}
      {hasActiveAudio && !isFullscreenVisible && !isOnMixesPage && (
        <div className='flex-shrink-0'>
          <AudioPlayer />
        </div>
      )}

      {/* Queue Drawer */}
      <QueueColumn />

      {/* Fullscreen Audio Player */}
      <FullscreenAudioPlayer />
    </div>
  )
}
