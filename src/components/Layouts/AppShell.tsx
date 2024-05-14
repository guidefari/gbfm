import React from 'react'
import Nav from '../Nav'
import { SuperHero } from './SuperHero'
import { SideNav } from '../SideNav'

type Props = {
  children: React.ReactNode
}

export default function AppShell({ children }: Props) {
  return (
    <>
      <SideNav />
      <main className="lg:pl-28 flex flex-col justify-between h-full overflow-hidden overflow-y-auto min-h-[calc(100dvh-16rem)] font-jetbrains">
        {children}
      </main>
      <footer className="px-5 mb-24">
        <SuperHero />
      </footer>
      <Nav />
    </>
  )
}
