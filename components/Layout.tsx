import Nowplaying from '@/components/Nowplaying'
import Link from 'next/link'
import { AudioControls } from './AudioControls'
import { GB } from './common/icons'
import { Newsletter } from './Newsletter'
import SideBar from './SideBar'

type Props = {
  children: React.ReactNode
}

export default function Layout({ children }: Props) {
  return (
    <>
      <SideBar />
      <main className="flex flex-col justify-between w-full h-full overflow-hidden md:pl-20 pl-11 lg:pl-20 font-jetbrains">
        {children}
        <footer className="px-5 mt-32 mb-10">
          <Newsletter />
          <Nowplaying />
        </footer>
      </main>
    </>
  )
}
