import { useAudioPlayerContext } from 'src/contexts/AudioPlayer'
import { useRouter } from 'next/router'
import { RxHome } from 'react-icons/rx'
import {
  GiAnticlockwiseRotation,
  GiClockwiseRotation,
  GiPlayButton,
  GiPauseButton,
} from 'react-icons/gi'
import Image from 'next/image'
import { useRef } from 'react'

const Nav = () => {
  const [audioRef, handlers, isPlaying, thumbnailUrl, progress] = useAudioPlayerContext()
  const router = useRouter()
  const navRef = useRef<HTMLElement>(null)

  return (
    <nav ref={navRef} className="fixed bottom-0 z-50 w-full pt-1 space-y-1 bg-sky-900">
      <div className="relative grid h-full max-w-lg grid-flow-col mx-auto">
        <button
          onClick={() => router.push('/')}
          data-tooltip-target="tooltip-home"
          type="button"
          className=" floating-nav-button"
        >
          <RxHome className="floating-nav-icon" />
        </button>

        <>
          <button
            data-tooltip-target="tooltip-wallet"
            type="button"
            className="floating-nav-button"
          >
            <GiAnticlockwiseRotation
              onClick={() => handlers.jumpBackward()}
              className="floating-nav-icon"
              title="-15s"
            />
          </button>
          <button
            type="button"
            className="floating-nav-button"
            title="Play/Pause"
            onClick={() => (isPlaying ? handlers.pause() : handlers.play())}
          >
            {isPlaying ? (
              <GiPauseButton className="floating-nav-icon" />
            ) : (
              <GiPlayButton className="floating-nav-icon" />
            )}
          </button>
          <button
            data-tooltip-target="tooltip-settings"
            type="button"
            className="floating-nav-button"
            title="+30s"
          >
            <GiClockwiseRotation
              onClick={() => handlers.jumpForward()}
              className="floating-nav-icon"
            />
          </button>
          <Image
            src={thumbnailUrl}
            className="min-w-[45px] w-12 m-auto rounded-md aspect-square"
            alt=""
            width={80}
            height={80}
          />
        </>
      </div>
      <div
        className="flex max-w-xl mx-auto hover:cursor-pointer"
        onClick={() => alert('Congratulations🎉you discovered a work in progress')}
      >
        <div
          style={{ width: `${progress}%` }}
          className={`bg-gb-tomato opacity-90 h-1.5 align-start rounded-full `}
        ></div>
      </div>
    </nav>
  )
}

export default Nav
