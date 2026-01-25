import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { StartListeningButton } from '@/components/StartListeningButton'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'

export const Route = createFileRoute('/')({
  component: Index,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.home)
  })
})

function Index() {
  const [oneSecondLater, setOneSecondLater] = useState(false)
  const openCmd = useUIStore((s) => s.openCmd)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setOneSecondLater(true)
    }, 1000)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className='flex flex-col items-center justify-center h-full px-1 overflow-y-hidden leading-none'>
      <div className='flex flex-col gap-6 lg:flex-row w-fit'>
        <h1 className='pr-6 my-0 text-5xl font-bold text-right border-r-2 w-fit md:text-7xl'>
          goosebumps.
          <br />
          <span className='text-highlight'>fm</span>
        </h1>

        <nav
          className={cn(
            'mt-4 text-sm min-w-52 text-background flex flex-col gap-2 opacity-0 transition-all duration-500 ease-in-out',
            oneSecondLater && 'text-secondary-foreground opacity-100'
          )}>
          <StartListeningButton />

          <hr className='border-t-2' />
          <button
            type='button'
            onClick={openCmd}
            className='flex items-center gap-2 transition-colors hover:text-highlight'>
            <kbd className='inline-flex h-5 bg-muted text-secondary-foreground items-center gap-1 border px-1.5 font-mono text-[10px] font-medium select-none'>
              <span className='text-xs'>
                {typeof navigator !== 'undefined' &&
                navigator.platform.includes('Mac')
                  ? '⌘'
                  : 'Ctrl'}
              </span>
              K
            </kbd>
            <span className='text-xs'>navigate</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
