import type { ReactNode } from 'react'

export function ShowsPageLayout({ children }: { children: ReactNode }) {
  return <div className='w-full px-4 py-4 sm:px-6 sm:py-6'>{children}</div>
}
