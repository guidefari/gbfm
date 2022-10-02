import Nowplaying from '@/components/Nowplaying'
import { Newsletter } from './Newsletter'

export default function Layout({ children }) {
  return (
    <>
      <div className="flex flex-col justify-between min-h-screen overflow-x-hidden font-jetbrains">
        <main>{children}</main>
        <footer className="px-5 mt-32 mb-10">
          <Newsletter />
          <Nowplaying />
        </footer>
      </div>
    </>
  )
}
