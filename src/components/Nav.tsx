import { useAudioPlayerContext } from 'src/contexts/AudioPlayer'
import { useRouter } from 'next/router'
import { HiHome } from 'react-icons/hi'
import { GiPlayButton, GiPauseButton } from 'react-icons/gi'
import Image from 'next/image'
import { useRef } from 'react'
import { formatSeconds } from '@/lib/util'

const Nav = () => {
  const [audioRef, handlers, isPlaying, thumbnailUrl, progress] = useAudioPlayerContext()
  const router = useRouter()
  const navRef = useRef<HTMLElement>(null)

  const changeRange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    handlers.setTimeUsingPercentage(Number(value))
  }

  if (!audioRef?.src) return <></>

  return (
    <nav
      ref={navRef}
      className="fixed transition ease-in-out delay-150 bottom-0 z-50 w-full py-2 space-y-1 bg-sky-900"
    >
      <div className="relative grid items-center h-full max-w-xs grid-flow-col mx-auto">
        <button
          onClick={() => router.push('/')}
          data-tooltip-target="tooltip-home"
          type="button"
          className=" floating-nav-button"
        >
          <HiHome className="floating-nav-icon" />
        </button>

        <>
          <button
            data-tooltip-target="tooltip-wallet"
            type="button"
            className="text-xs floating-nav-button"
            onClick={() => handlers.jumpBackward()}
          >
            {`-15s`}
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
            className="text-xs floating-nav-button"
            title="+30s"
            onClick={() => handlers.jumpForward()}
          >
            {`+30s`}
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
      <div className="flex items-center max-w-xl mx-auto space-x-1 rounded-full">
        <p className="text-xs ">{formatSeconds(audioRef?.currentTime || 0)}</p>
        <input
          type="range"
          value={progress}
          className={`bg-gb-tomato h-2 w-full align-start rounded-full hover:cursor-pointer `}
          onInput={changeRange}
        />
        <p className="text-xs ">{formatSeconds(audioRef?.duration || 0)}</p>
      </div>
    </nav>
  )
}

export default Nav
