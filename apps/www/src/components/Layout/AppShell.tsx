import type React from 'react'
import AudioPlayer from '@/components/AudioPlayer'
import FullscreenAudioPlayer from '@/components/FullscreenAudioPlayer'
import { QueueColumn } from '@/components/queue/QueueColumn'
import { useAudioPlayerInitializer } from '@/hooks/useAudioPlayer'
import { cn } from '@/lib/utils'
import { useAudioPlayerState } from '@/store/audioPlayer'

// import { HorizontalMenu } from "./HorizontalMenu";
// import { DesktopSideNav } from "./DesktopSideNav";

type Props = {
  children: React.ReactNode
  showFooter?: boolean
}

export default function AppShell({ children }: Props) {
  useAudioPlayerInitializer()

  const { audioSrc, isQueueVisible, isFullscreenVisible } =
    useAudioPlayerState()
  const hasActiveAudio = Boolean(audioSrc)

  return (
    <div className='grid grid-rows-[minmax(0,1fr)_auto] h-screen bg-background overflow-hidden'>
      <div
        className={cn(
          'grid min-h-0 transition-all duration-300 ease-in-out',
          isQueueVisible ? 'grid-cols-[1fr_20rem]' : 'grid-cols-[1fr_0px]'
        )}>
        <main className='overflow-y-auto px-4 min-h-0 sm:px-6 md:px-8 lg:px-10 bg-background'>
          {children}
        </main>

        <div className='overflow-hidden h-full'>
          <QueueColumn />
        </div>
      </div>

      {/* Audio Player - Always at bottom, full width */}
      {hasActiveAudio && !isFullscreenVisible && <AudioPlayer />}

      {/* Fullscreen Audio Player */}
      <FullscreenAudioPlayer />
    </div>
  )
}
