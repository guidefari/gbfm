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
      <main className="flex flex-col justify-between h-full overflow-hidden font-jetbrains max-h-dvh overflow-y-auto">
        {children}
        <footer className="px-5 mb-24">
          <SuperHero />
          <Newsletter />
        </footer>
      </main>
      <Nav />
    </>
  )
}
