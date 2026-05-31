import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { FeaturedMixHero } from '@/components/home/FeaturedMixHero'
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
    <div className='flex flex-col items-center justify-center min-h-full gap-10 px-4 py-12'>
      <h1 className='my-0 text-5xl font-bold text-center leading-none md:text-7xl'>
        goosebumps.<span className='text-highlight'>fm</span>
      </h1>

      <FeaturedMixHero />

      <button
        type='button'
        onClick={openCmd}
        className={cn(
          'items-center gap-2 text-secondary-foreground transition-all duration-500 ease-in-out hover:text-highlight hidden lg:flex opacity-0',
          oneSecondLater && 'opacity-100'
        )}>
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
    </div>
  )
}
