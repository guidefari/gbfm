import React from 'react'
import Nowplaying from 'src/components/Nowplaying'
import { Newsletter } from './Newsletter'
import Nav from './Nav'

type Props = {
  children: React.ReactNode
}

export default function Layout({ children }: Props) {
  return (
    <>
      <Nav />
      <main className="flex flex-col justify-between w-full h-full overflow-hidden font-jetbrains">
        {children}
        <footer className="px-5 mb-24">
          <Newsletter />
          <Nowplaying />
        </footer>
      </main>
    </>
  )
}
