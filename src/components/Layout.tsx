import React from 'react'
import { Newsletter } from './Newsletter'
import Nav from './Nav'

type Props = {
  children: React.ReactNode
}

export default function Layout({ children }: Props) {
  return (
    <>
      <main className="flex flex-col justify-between w-full h-full overflow-hidden font-jetbrains">
        {children}
      </main>
      <hr className="w-full h-1 my-8 border-2 bg-gb-bg" />
      <footer className="px-5 mb-24">
        <Newsletter />
      </footer>
      <Nav />
    </>
  )
}
