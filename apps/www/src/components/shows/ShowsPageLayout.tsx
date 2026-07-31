import type { ReactNode } from 'react'

export function ShowsPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className='mx-auto w-full max-w-7xl py-8'>
      <div className='mx-auto w-full max-w-3xl px-4'>
        <div className='mb-8 flex flex-col gap-1 border-b border-border/40 pb-4'>
          <h1 className='text-2xl font-black tracking-tight text-foreground'>Radio shows</h1>
          <p className='text-sm text-muted-foreground'>Curated series, episode by episode.</p>
        </div>
      </div>
      <div className='px-4'>{children}</div>
    </div>
  )
}
