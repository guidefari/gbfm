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
  const hasActiveAudio = Boolean(audioSrc)

  return (
    <div className='flex flex-col h-screen bg-background'>
      <main className='flex-1 px-4 overflow-y-auto sm:px-6 md:px-8 lg:px-10 bg-background'>
        {children}
      </main>

      {/* Audio Player - Fixed at bottom, full width */}
      {hasActiveAudio && !isFullscreenVisible && (
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
