import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: Index,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.home)
  })
})

function Index() {
  const [oneSecondLater, setOneSecondLater] = useState(false)
  const timeout = setTimeout(() => {
    setOneSecondLater(true)
  }, 1000)

  useEffect(() => {
    return () => clearTimeout(timeout)
  }, [timeout])

  return (
    <div className='flex flex-col items-center justify-center h-full px-1 overflow-y-hidden leading-none'>
      <div className='inline-block w-fit'>
        <h1 className='my-0 text-5xl font-bold text-right w-fit md:text-7xl'>
          goosebumps.
          <br />
          <span className='text-highlight'>fm</span>
          <aside className='text-sm'>
            <p
              className={cn(
                'text-sm text-left w-full text-background opacity-0 transition-all duration-500 ease-in-out',
                oneSecondLater && 'text-secondary-foreground opacity-100'
              )}>
              Press{' '}
              <kbd
                className={cn(
                  'pointer-events-none inline-flex h-5 bg-muted text-secondary-foreground items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none'
                )}>
                <span className='text-xs'>
                  {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
                </span>
                K
              </kbd>
            </p>
          </aside>
        </h1>
      </div>
    </div>
  )
}
