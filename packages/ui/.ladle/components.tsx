import type { ReactNode } from 'react'
import '../src/styles.css'

interface ProviderProps {
  children: ReactNode
}

export const Provider = ({ children }: ProviderProps) => {
  return (
    <div className='min-h-screen bg-background p-6 text-foreground'>
      {children}
    </div>
  )
}
