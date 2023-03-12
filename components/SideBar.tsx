import { useAudioPlayerContext } from 'contexts/AudioPlayer';
import Link from 'next/link';
import { AudioControls } from './AudioControls';
import { GB } from './common/icons';

const SideBar = () => {
    const [audioRef] = useAudioPlayerContext()
    
    
  return (
    <div className="fixed top-0 left-0 flex flex-col items-center w-10 h-screen shadow-sm md:w-20">
           <Link href="/">
              <button className='nav-button'>
                <GB />
              </button>
            </Link>
            {audioRef?.src ? (
                    <AudioControls />
                ) : null
            }
        <hr />
    </div>
  );
};



export default SideBar;
