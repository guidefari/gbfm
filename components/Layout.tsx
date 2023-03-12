import Nowplaying from '@/components/Nowplaying'
import Link from 'next/link'
import { AudioControls } from './AudioControls'
import { GB } from './common/icons'
import { Newsletter } from './Newsletter'

export default function Layout({ children }) {
  const buttonStyles =
    'z-20 text-[#54BCF7] p-3 md:m-5 transition duration-300 ease-in-out rounded-full w-14 h-14 hover:bg-gb-bg hover:shadow-md hover:text-tomato hover:cursor-pointer'

  return (
    <div className="flex flex-col justify-between min-h-screen overflow-x-hidden font-jetbrains">
      <div className="grid grid-cols-12">
        
        <header className="grid bg-transparent col-span-full lg:col-span-1 ">
          <nav className="flex items-center space-x-2 lg:space-y-2 lg:space-x-0 lg:flex-col ">
            <Link href="/">
              <button className={buttonStyles}>
                <GB />
              </button>
            </Link>
            <button className={buttonStyles}>
              <AudioControls />
            </button>
          </nav>
        </header>
        <main className="grid col-span-full lg:col-span-11">{children}</main>
        <nav className="grid col-span-1" />
      </div>
      <footer className="px-5 mt-32 mb-10">
        <Newsletter />
        <Nowplaying />
      </footer>
    </div>
  )
}
