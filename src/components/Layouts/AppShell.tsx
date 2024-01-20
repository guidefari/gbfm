import React from 'react'
import { Newsletter } from '../Newsletter'
import Nav from '../Nav'
import { SuperHero } from './SuperHero'

type Props = {
  children: React.ReactNode
}

export default function AppShell({ children }: Props) {
  return (
    <>
      <main className="flex flex-col justify-between h-full overflow-hidden font-jetbrains">
        {children}
      </main>
      <hr className="w-full h-1 my-8 border-2 bg-gb-bg" />
      <footer className="px-5 mb-24">
        <SuperHero />
        <Newsletter />
      </footer>
      <Nav />
    </>
  )
}
