import { useAudioPlayerContext } from 'src/contexts/AudioPlayer'
import { useRouter } from 'next/router'
import { RxHome, RxTriangleLeft, RxTriangleRight, RxPause, RxPlay } from 'react-icons/rx'
import Image from 'next/image'

const SideBar = () => {
  const [audioRef, handlers, isPlaying, thumbnailUrl] = useAudioPlayerContext()
  const router = useRouter()
  return (
    <>
      <nav className="fixed z-50 h-16 max-w-lg pr-1 translate-x-1/2 bg-white border border-gray-200 rounded-lg right-1/2 translate bottom-4 dark:bg-gray-600 dark:border-gray-600">
        <div className="grid h-full max-w-lg grid-flow-col mx-auto">
          <button
            onClick={() => router.push('/')}
            data-tooltip-target="tooltip-home"
            type="button"
            className=" floating-nav-button"
          >
            <RxHome className="floating-nav-icon" />
          </button>

          {audioRef?.src ? (
            <>
              <button
                data-tooltip-target="tooltip-wallet"
                type="button"
                className="floating-nav-button"
              >
                <RxTriangleLeft
                  onClick={() => handlers.jumpBackward()}
                  className="floating-nav-icon"
                  title="-10s"
                />
              </button>
              <button
                type="button"
                className="floating-nav-button"
                title="Toggle Audio On/Off"
                onClick={() => (isPlaying ? handlers.pause() : handlers.play())}
              >
                {isPlaying ? <RxPause /> : <RxPlay />}
              </button>
              <button
                data-tooltip-target="tooltip-settings"
                type="button"
                className="floating-nav-button"
                title="+10s"
              >
                <RxTriangleRight
                  onClick={() => handlers.jumpForward()}
                  className="floating-nav-icon"
                />
              </button>
              <Image
                src={thumbnailUrl}
                className="min-w-[45px] w-12 m-auto rounded-md aspect-square "
                alt=""
                width={80}
                height={80}
              />
            </>
          ) : null}
        </div>
      </nav>
    </>
  )
}

export default SideBar
