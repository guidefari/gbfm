import type React from 'react'
import AudioPlayer from '@/components/AudioPlayer'
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

  const { audioSrc, isQueueVisible } = useAudioPlayerState()
  const hasActiveAudio = Boolean(audioSrc)

  return (
    <div className='flex overflow-hidden flex-col h-screen bg-background'>
      {/* Main Content - takes available space above audio player */}
      <div className='flex overflow-hidden flex-1'>
        {/* Main Content Column */}
        <div
          className={cn(
            'flex flex-col flex-1 transition-all duration-300 ease-in-out',
            isQueueVisible && 'mr-80'
          )}>
          {/* Scrollable Main Content */}
          <main className='overflow-y-auto flex-1 px-4 sm:px-6 md:px-8 lg:px-10 bg-background'>
            {children}
          </main>
        </div>

        {/* Queue Column - slides in from the right */}
        <div
          className={cn(
            'h-full transition-transform duration-300 ease-in-out',
            isQueueVisible ? 'translate-x-0' : 'translate-x-full'
          )}>
          <QueueColumn />
        </div>
      </div>

      {/* Audio Player - Always at bottom, full width */}
      {hasActiveAudio && <AudioPlayer />}
    </div>
  )
}
