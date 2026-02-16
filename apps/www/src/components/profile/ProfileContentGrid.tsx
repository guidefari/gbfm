import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import HorizontalScrollCards from '@/components/common/HorizontalScrollCards'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import type { PublicProfile } from '@/lib/http'

interface ProfileContentGridProps {
  content: PublicProfile['content']
}

type Mix = PublicProfile['content']['mixes'][number]
// type Show = PublicProfile['content']['shows'][number]
type Dispatch = PublicProfile['content']['dispatches'][number]
type Ping = PublicProfile['content']['pings'][number]

const CARD_CLASS = 'w-36 flex-shrink-0'

function StandaloneMixCard({ mix }: { mix: Mix }) {
  return (
    <Link
      to='/mixes/$mixId'
      params={{ mixId: mix.slug }}
      className={`${CARD_CLASS} flex flex-col gap-2 group`}>
      <div className='w-full overflow-hidden border rounded-sm shadow-sm aspect-square border-border bg-background'>
        <img
          src={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
          alt={mix.title}
          className='object-cover w-full h-full transition-opacity group-hover:opacity-80'
        />
      </div>
      <h3 className='text-sm font-semibold leading-tight transition-colors text-foreground group-hover:text-highlight line-clamp-2'>
        {mix.title}
      </h3>
    </Link>
  )
}

function ProfileDispatchCard({ dispatch }: { dispatch: Dispatch }) {
  return (
    <Link
      to='/dispatch/$slug'
      params={{ slug: dispatch.slug }}
      className={`${CARD_CLASS} flex flex-col gap-2 group`}>
      {dispatch.thumbnailUrl && (
        <div className='w-full overflow-hidden border rounded-sm shadow-sm aspect-video border-border bg-background'>
          <img
            src={dispatch.thumbnailUrl}
            alt={dispatch.title}
            className='object-cover w-full h-full transition-opacity group-hover:opacity-80'
          />
        </div>
      )}
      <h3 className='text-sm font-semibold leading-tight transition-colors text-foreground group-hover:text-highlight line-clamp-2'>
        {dispatch.title}
      </h3>
    </Link>
  )
}

function ProfilePingCard({ ping }: { ping: Ping }) {
  const date = new Date(ping.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <Link
      to='/pings/$slug'
      params={{ slug: ping.slug }}
      className={`${CARD_CLASS} flex flex-col gap-1 p-3 transition-colors border rounded-lg group border-border bg-card hover:bg-muted/50`}>
      <h3 className='text-sm font-semibold leading-tight transition-colors text-foreground group-hover:text-highlight line-clamp-2'>
        {ping.title}
      </h3>
      <p className='text-xs text-muted-foreground'>{date}</p>
    </Link>
  )
}

function ContentSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    )
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = scrollRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    )
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState)
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      observer.disconnect()
    }
  }, [updateScrollState])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    )
    if (!el) return
    const amount = el.clientWidth * 0.75
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    })
  }

  return (
    <section>
      <div className='flex items-center justify-between mb-3'>
        <h2 className='text-lg font-semibold text-foreground'>{title}</h2>
        <div className='flex gap-1'>
          <button
            type='button'
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className='p-1 transition-colors rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-0'>
            <ChevronLeft className='w-5 h-5' />
          </button>
          <button
            type='button'
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className='p-1 transition-colors rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-0'>
            <ChevronRight className='w-5 h-5' />
          </button>
        </div>
      </div>
      <div ref={scrollRef}>
        <HorizontalScrollCards>{children}</HorizontalScrollCards>
      </div>
    </section>
  )
}

export function ProfileContentGrid({ content }: ProfileContentGridProps) {
  const mixes = content?.mixes ?? []
  const shows = content?.shows ?? []
  const dispatches = content?.dispatches ?? []
  const pings = content?.pings ?? []

  const hasContent =
    shows.length > 0 ||
    mixes.length > 0 ||
    dispatches.length > 0 ||
    pings.length > 0

  if (!hasContent) {
    return (
      <div className='py-8 text-center text-muted-foreground'>
        No public content yet
      </div>
    )
  }

  return (
    <div className='space-y-8'>
      {/* {shows.length > 0 && (
        <ContentSection title='Shows'>
          {shows.map((show) => (
            <ProfileShowCard key={show.id} show={show} />
          ))}
        </ContentSection>
      )} */}

      {mixes.length > 0 && (
        <ContentSection title='Mixes'>
          {mixes.map((mix) => (
            <StandaloneMixCard key={mix.id} mix={mix} />
          ))}
        </ContentSection>
      )}

      {dispatches.length > 0 && (
        <ContentSection title='Dispatches'>
          {dispatches.map((dispatch) => (
            <ProfileDispatchCard key={dispatch.id} dispatch={dispatch} />
          ))}
        </ContentSection>
      )}

      {pings.length > 0 && (
        <ContentSection title='Pings'>
          {pings.map((ping) => (
            <ProfilePingCard key={ping.id} ping={ping} />
          ))}
        </ContentSection>
      )}
    </div>
  )
}
