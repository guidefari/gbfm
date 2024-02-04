import React from 'react'
import Nav from '../Nav'
import { SuperHero } from './SuperHero'

type Props = {
  children: React.ReactNode
}

export default function AppShell({ children }: Props) {
  return (
    <>
      <main className="flex flex-col justify-between h-full overflow-hidden overflow-y-auto font-jetbrains max-h-dvh">
        {children}
        <footer className="px-5 mb-24">
          <SuperHero />
        </footer>
      </main>
      <Nav />
    </>
  )
}
