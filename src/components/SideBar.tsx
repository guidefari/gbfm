import { useAudioPlayerContext } from 'src/contexts/AudioPlayer'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AudioControls } from './AudioControls'
import { BackIcon, GB } from './common/icons'

const SideBar = () => {
  const [audioRef] = useAudioPlayerContext()
  const router = useRouter()

  function handleBackClick() {
    if (router.pathname !== '/' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  return (
    <div className="fixed top-0 left-0 flex flex-col items-center w-10 h-screen shadow-sm md:w-20">
      <button title="Go Back" onClick={handleBackClick} type="button" className="nav-button">
        <GB />
      </button>
      {audioRef?.src ? <AudioControls /> : null}
      <hr />
    </div>
  )
}

export default SideBar
