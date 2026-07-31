import type { ReactNode } from 'react'

export function ShowsPageLayout({ children }: { children: ReactNode }) {
  return <div className='mx-auto w-full max-w-6xl px-4 py-6 sm:py-8'>{children}</div>
}
