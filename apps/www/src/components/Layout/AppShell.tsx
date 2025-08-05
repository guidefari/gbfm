import type React from 'react'
import AudioPlayer from '@/components/AudioPlayer'
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

  const { audioSrc } = useAudioPlayerState()
  const hasActiveAudio = Boolean(audioSrc)

  return (
    <div className='flex relative min-h-dvh bg-background'>
      {/* <DesktopSideNav /> */}
      <div
        className={cn(
          'flex flex-col flex-grow sm:gap-4'
          // todo: this is needed for the desktop side nav, if i decide to bring it back.
          // "sm:py-4 sm:pl-14"
        )}>
        {/* <HorizontalMenu /> */}
        <main
          className={'z-10 flex-1 px-4 sm:px-6 md:px-8 lg:px-10 bg-background'}
          style={{
            // lol, the other half of this is at AudioPlayer.tsx
            paddingBottom: hasActiveAudio
              ? 'var(--audio-player-height, 0px)'
              : '0px'
          }}>
          {children}
        </main>
        {/* {showFooter && <Footer />} */}
      </div>
      <AudioPlayer />
    </div>
  )
}
