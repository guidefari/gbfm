import Nowplaying from '@/components/Nowplaying'

export default function Layout({ children }) {
  return (
    <>
      <div className="flex flex-col justify-between min-h-screen overflow-x-hidden font-jetbrains">
        <main>{children}</main>
        <footer className="px-5 my-3">
          <Nowplaying />
        </footer>
      </div>
    </>
  )
}
