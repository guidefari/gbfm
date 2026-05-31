import { createFileRoute } from '@tanstack/react-router'
import { FeaturedMixHero } from '@/components/home/FeaturedMixHero'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'

export const Route = createFileRoute('/')({
  component: Index,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.home)
  })
})

function Index() {
  return (
    <div className='flex min-h-full items-center justify-center px-6 py-12'>
      <div className='flex w-fit flex-col items-center gap-10 xl:flex-row xl:items-center xl:gap-12'>
        <h1 className='my-0 w-fit shrink-0 text-center font-bold leading-[0.85] tracking-tight text-[min(12vw,4.5rem)] md:text-8xl xl:text-right xl:text-9xl xl:border-r-2 xl:border-foreground/30 xl:pr-12'>
          goosebumps.
          <br />
          <span className='text-highlight'>fm</span>
        </h1>

        <div className='flex w-full max-w-sm shrink-0 xl:w-80'>
          <FeaturedMixHero />
        </div>
      </div>
    </div>
  )
}
