import { Nowplaying } from '@/components/spotify/Nowplaying.tsx'

export default function Layout({ children }) {
  return (
    <>
      <div className="wrapper">{children}</div>
      <footer>
        <Nowplaying />
      </footer>
    </>
  )
}
