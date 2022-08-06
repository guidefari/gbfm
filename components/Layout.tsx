import Nowplaying from '@/components/Nowplaying'

export default function Layout({ children }) {
  return (
    <>
      <div className="flex flex-col justify-between min-h-screen font-jetbrains">
        <main>{children}</main>
        <footer className="my-3">
          <Nowplaying />
        </footer>
      </div>
    </>
  )
}
