import type { ReactNode } from 'react'

export function ShowsPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className='mx-auto w-full max-w-6xl px-4 py-6 sm:py-8'>
      <div className='mb-6 flex flex-col gap-1 border-b border-border/40 pb-4'>
        <h1 className='text-2xl font-black tracking-tight text-foreground'>Radio shows</h1>
        <p className='text-sm text-muted-foreground'>Curated series, episode by episode.</p>
      </div>
      {children}
    </div>
  )
}
